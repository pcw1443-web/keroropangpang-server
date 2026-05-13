import * as net from "net";
import * as http from "http";
import * as https from "https";
import * as fs from "fs";
import { CryptoManager } from "./network";

// ─────────────────────────────────────────
// GameGuard 업데이트 서버 우회용 더미 HTTP 서버 (포트 80)
// ─────────────────────────────────────────
http
  .createServer((req, res) => {
    console.log(`[GameGuard HTTP] ${req.method} ${req.headers.host}${req.url}`);
    res.writeHead(200, { "Content-Type": "text/plain", "Content-Length": "2" });
    res.end("OK");
  })
  .listen(80, "0.0.0.0", () => {
    console.log("[GameGuard] Dummy HTTP server listening on port 80");
  })
  .on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EACCES") {
      console.error("[GameGuard] 포트 80 접근 권한 없음 → 관리자 권한으로 실행하세요.");
    } else if (err.code === "EADDRINUSE") {
      console.error("[GameGuard] 포트 80이 이미 사용 중입니다. IIS 등 다른 서비스를 종료하세요.");
    } else {
      console.error("[GameGuard] HTTP 서버 오류:", err);
    }
  });

// ─────────────────────────────────────────
// GameGuard 업데이트 서버 우회용 더미 HTTPS 서버 (포트 443)
// ─────────────────────────────────────────
https
  .createServer(
    {
      key: fs.readFileSync("server.key"),
      cert: fs.readFileSync("server.crt"),
    },
    (req, res) => {
      console.log(`[GameGuard HTTPS] ${req.method} ${req.headers.host}${req.url}`);
      res.writeHead(200, { "Content-Type": "text/plain", "Content-Length": "2" });
      res.end("OK");
    }
  )
  .listen(443, "0.0.0.0", () => {
    console.log("[GameGuard] Dummy HTTPS server listening on port 443");
  })
  .on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EACCES") {
      console.error("[GameGuard] 포트 443 접근 권한 없음 → 관리자 권한으로 실행하세요.");
    } else if (err.code === "EADDRINUSE") {
      console.error("[GameGuard] 포트 443이 이미 사용 중입니다.");
    } else {
      console.error("[GameGuard] HTTPS 서버 오류:", err);
    }
  });

// ─────────────────────────────────────────
// 케로로팡팡 게임 서버 (TCP, 포트 18608)
// ─────────────────────────────────────────
net
  .createServer((socket) => {
    const remoteAddr = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[Game] 클라이언트 접속: ${remoteAddr}`);

    let globalBuffer = Buffer.allocUnsafe(0);
    let globalPacketLength = -1;
    const cryptoManager = new CryptoManager();

    const performPacket = (data: Buffer) => {
      globalBuffer = Buffer.concat([globalBuffer, data]);

      if (globalPacketLength < 0 && globalBuffer.length >= 56) {
        globalPacketLength = CryptoManager.decrypt_header(globalBuffer).readUInt16LE(24);
      }

      if (globalBuffer.length <= 0 || globalBuffer.length < globalPacketLength) return;

      const decrypted_data = cryptoManager.crypt(
        globalBuffer.slice(32, globalPacketLength)
      );

      console.log(`[Game] 패킷 수신 (${remoteAddr}):`, decrypted_data);

      const slicedPacket = globalBuffer.slice(globalPacketLength);
      globalBuffer = Buffer.allocUnsafe(0);
      globalPacketLength = -1;

      if (slicedPacket.length > 0) {
        performPacket(slicedPacket);
      }
    };

    socket.on("data", performPacket);
    socket.on("error", (err) => {
      console.error(`[Game] 소켓 오류 (${remoteAddr}):`, err.message);
    });
    socket.on("close", () => {
      console.log(`[Game] 클라이언트 연결 종료: ${remoteAddr}`);
    });
  })
  .listen(18608, "0.0.0.0", () => {
    console.log("[Game] 게임 서버 listening on port 18608");
  })
  .on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error("[Game] 포트 18608이 이미 사용 중입니다.");
    } else {
      console.error("[Game] 게임 서버 오류:", err);
    }
  });