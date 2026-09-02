import fs from "node:fs";
import http from "node:http";
import url from "node:url";

const ROOT = "/tmp/frosta-codeql-probe-root/";
const server = http.createServer((req, res) => {
  const filePath = url.parse(req.url, true).query.path;
  res.write(fs.readFileSync(ROOT + filePath, "utf8"));
});
server.listen(0);
