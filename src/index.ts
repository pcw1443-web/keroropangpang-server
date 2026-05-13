import * as net from "net";
import * as http from "http";
import * as https from "https";
import * as fs from "fs";
import { CryptoManager } from "./network";

// ─────────────────────────────────────────
// GameGuard 업데이트 서버 우회용 가짜 서버 (포트 80 & 443)
// ─────────────────────────────────────────
const handleGGRequest = (req: http.IncomingMessage, res: http.ServerResponse) => {
    const url = req.url || "/";
    console.log(`[GameGuard] 요청 감지: ${req.method} ${req.headers.host}${url}`);

    // 게임가드가 가장 먼저 찾는 업데이트 설정 파일들
    if (url.includes("patch.erl") || url.includes("version.ini") || url.includes("nprotect.des")) {
        console.log(`[GameGuard] 업데이트 파일 요청됨 -> 최신 버전인 척 응답합니다.`);
        
        // 200 OK 응답과 함께 빈 데이터(0바이트) 혹은 성공 헤더 전송
        res.writeHead(200, {
            "Content-Type": "application/octet-stream",
            "Connection": "close"
        });
        res.end(); // 파일이 없으므로 빈 응답을 보내 업데이트가 필요 없음을 알림
    } else {
        // 그 외 기본 요청은 OK로 응답
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("OK");
    }
};

// HTTP 서버 (80)
http.createServer(handleGGRequest).listen(80, "0.0.0.0", () => {
    console.log("[GameGuard] Dummy HTTP server listening on port 80");
}).on("error", (err: any) => {
    if (err.code === "EACCES") console.error("[Error] 포트 80: 관리자 권한으로 실행하세요!");
});

// HTTPS 서버 (443)
https.createServer({
    key: fs.readFileSync("server.key"),
    cert: fs.readFileSync("server.crt"),
}, handleGGRequest).listen(443, "0.0.0.0", () => {
    console.log("[GameGuard] Dummy HTTPS server listening on port 443");
}).on("error", (err: any) => {
    if (err.code === "EACCES") console.error("[Error] 포트 443: 관리자 권한으로 실행하세요!");
});

// ─────────────────────────────────────────
// 케로로팡팡 게임 서버 (TCP, 포트 18608)
// ─────────────────────────────────────────
net.createServer((socket) => {
    const remoteAddr = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[Game] 클라이언트 접속: ${remoteAddr}`);

    let globalBuffer = Buffer.allocUnsafe(0);
    let globalPacketLength = -1;
    const cryptoManager = new CryptoManager();

    const performPacket = (data: Buffer) => {
        globalBuffer = Buffer.concat([globalBuffer, data]);

        // 헤더 복호화 및 길이 확인 (32바이트 헤더 기준)
        if (globalPacketLength < 0 && globalBuffer.length >= 32) {
            const decodedHeader = CryptoManager.decrypt_header(globalBuffer);
            globalPacketLength = decodedHeader.readUInt32LE(24);
        }

        if (globalPacketLength <= 0 || globalBuffer.length < globalPacketLength) return;

        // 실제 데이터 복호화
        const decrypted_data = cryptoManager.crypt(
            globalBuffer.slice(32, globalPacketLength)
        );
        console.log(`[Game] 패킷 수신 (${remoteAddr}):`, decrypted_data);

        const slicedPacket = globalBuffer.slice(globalPacketLength);
        globalBuffer = Buffer.allocUnsafe(0);
        globalPacketLength = -1;

        if (slicedPacket.length > 0) performPacket(slicedPacket);
    };

    socket.on("data", performPacket);
    socket.on("error", (err) => console.error(`[Game] 오류: ${err.message}`));
    socket.on("close", () => console.log(`[Game] 연결 종료`));
}).listen(18608, "0.0.0.0", () => {
    console.log("[Game] 게임 서버 listening on port 18608");
});