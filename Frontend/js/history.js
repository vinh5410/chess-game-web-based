async function fetchUserHistory(userId) {
    const res = await fetch(`/api/history/user/${userId}`);
    const data = await res.json();
    if (data.success) {
        renderHistoryList(data.games);
    }
}

function renderHistoryList(games) {
    const container = document.getElementById('historyList');
    container.innerHTML = '';
    if (games.length === 0) {
        container.innerHTML = '<p>Bạn chưa có ván đấu nào.</p>';
        document.getElementById('replayArea').style.display = 'none';
        return;
    }
    games.forEach(game => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <span>${game.whitePlayer.username} vs ${game.blackPlayer.username}</span>
            <span>${game.result}</span>
            <button onclick="viewGameDetail('${game._id}')">Xem lại</button>
        `;
        container.appendChild(div);
    });
}

async function viewGameDetail(gameId) {
    const res = await fetch(`/api/history/game/${gameId}`);
    const data = await res.json();
    if (data.success) {
        document.getElementById('replayArea').style.display = '';
        replayGame(data.game);
    }
}

let chessBoardRenderer = null;

function replayGame(game) {
    if (!chessBoardRenderer) {
        chessBoardRenderer = new ChessBoardRenderer('chessCanvas');
        chessBoardRenderer.loadPieceImages().then(() => {
            replayGame(game);
        });
        return;
    }
    const renderer = chessBoardRenderer;
    const chess = renderer.game;
    // Chuyển đổi moves thành mảng từng nước đơn lẻ
    const flatMoves = [];
    for (const movePair of game.moves) {
        if (movePair.white) flatMoves.push({ ...movePair.white, color: 'w' });
        if (movePair.black) flatMoves.push({ ...movePair.black, color: 'b' });
    }
    let moveIndex = 0;

    function showMove(index) {
        renderer.reset();
        for (let i = 0; i < index; i++) { // chỉ thực hiện nước đi đến index-1
            const move = flatMoves[i];
            if (move) chess.move({ from: move.from, to: move.to, promotion: move.promotion });
        }
        renderer.draw();
        if (index === 0) {
            document.getElementById('moveInfo').innerText = 'Bàn cờ ban đầu';
        } else {
            document.getElementById('moveInfo').innerText = `Nước đi: ${index}/${flatMoves.length}`;
        }
    }

    document.getElementById('nextBtn').onclick = () => {
        if (moveIndex < flatMoves.length - 1) moveIndex++;
        showMove(moveIndex);
    };
    document.getElementById('prevBtn').onclick = () => {
        if (moveIndex > 0) moveIndex--;
        showMove(moveIndex);
    };

    showMove(moveIndex);
}