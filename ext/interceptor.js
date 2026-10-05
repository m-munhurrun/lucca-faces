(() => {
  "use strict";

  const DB = window.__FACE_DB__ || {};
  const MARK = " *";
  const TARGET = "/questions/next";
  const LOG = "[faces-helper]";

  const origFetch = window.fetch.bind(window);

  // --- hash ----------------------------------------------------------------

  async function sha256(buffer) {
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    return [...new Uint8Array(hashBuffer)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // Normalisation : accents retirés, minuscules, espaces compactés, trim.
  function norm(s) {
    return String(s)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  // --- marquage DOM --------------------------------------------------------

  // Cherche dans le DOM un noeud texte dont le contenu vaut exactement le nom
  // (normalisé) et le marque. Réessaie via MutationObserver tant que les
  // suggestions ne sont pas rendues (timeout 10 s).
  function markInDom(name) {
    const want = norm(name);

    const tryMark = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const raw = node.nodeValue;
        if (!raw) continue;
        if (raw.includes(MARK.trim()) === false && norm(raw) === want) {
          node.nodeValue = raw.replace(/\s+$/, "") + MARK;
          const el = node.parentElement;
          if (el) {
            el.style.background = "rgba(76, 175, 80, .35)";
            el.style.borderRadius = "4px";
            el.style.fontWeight = "bold";
          }
          console.info(`${LOG} marqué dans le DOM : ${name}`);
          el.click();
          return true;
        }
      }
      return false;
    };

    if (tryMark()) return;

    const obs = new MutationObserver(() => {
      if (tryMark()) obs.disconnect();
    });
    obs.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    setTimeout(() => obs.disconnect(), 10000);
  }

  // --- résolution du visage -----------------------------------------------

  async function resolve(data) {
    if (!data || !data.imageUrl) return;
    const picUrl = new URL(data.imageUrl, location.origin).href;
    const buf = await origFetch(picUrl, {
      credentials: "include",
      cache: "force-cache",
    }).then((r) => r.arrayBuffer());

    const hash = await sha256(buf);
    const name = DB[hash];

    if (!name) {
      console.warn(`${LOG} hash inconnu (${hash}) — visage absent de la base.`);
      return;
    }
    console.info(`${LOG} réponse : ${name}`);
    markInDom(name);
  }

  const isTarget = (url) => typeof url === "string" && url.includes(TARGET);

  // --- interception (passive : on lit, on ne modifie pas la réponse) ------

  window.fetch = async function (...args) {
    const res = await origFetch(...args);
    try {
      const input = args[0];
      const url = typeof input === "string" ? input : input && input.url;
      if (isTarget(url)) {
        res.clone().json().then(resolve).catch(() => { });
      }
    } catch (e) {
      console.warn(`${LOG} fetch hook error`, e);
    }
    return res;
  };

  const XHR = window.XMLHttpRequest;
  const open = XHR.prototype.open;

  XHR.prototype.open = function (method, url, ...rest) {
    if (isTarget(url)) {
      this.addEventListener("load", function () {
        try {
          const body =
            this.responseType === "json"
              ? this.response
              : JSON.parse(this.responseText);
          resolve(body);
        } catch (e) {
          console.warn(`${LOG} XHR parse error`, e);
        }
      });
    }
    return open.call(this, method, url, ...rest);
  };

  console.info(`${LOG} actif — ${Object.keys(DB).length} visages en base.`);
})();
