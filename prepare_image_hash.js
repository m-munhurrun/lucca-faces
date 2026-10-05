async function sha256FromUrl(url) {
  const response = await fetch(url, { cache: "force-cache" });
  const buffer = await response.arrayBuffer();

  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const bytes = [...new Uint8Array(hashBuffer)];

  return bytes.map(b => b.toString(16).padStart(2, "0")).join("");
}


const users = document.querySelectorAll('.employeeTile');
const mappedUsers = {};
const map = users.forEach(async (user) => {
    const imgUrl = user.querySelector('img')?.src;
    const name = user.querySelector('h4').innerText;

    if (!imgUrl) return

    const sha = await sha256FromUrl(imgUrl.replace('&width=200', '&width=300'));
    mappedUsers[sha] = name;
});

console.log(mappedUsers);