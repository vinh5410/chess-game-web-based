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

        // Helper to format player string with ELO
        const formatPlayer = (p) => {
            if (p.rating !== undefined) {
                return `${p.username} (${p.rating})`;
            }
            return p.username;
        };

        const whiteStr = formatPlayer(game.whitePlayer);
        const blackStr = formatPlayer(game.blackPlayer);

        div.innerHTML = `
            <span>${whiteStr} vs ${blackStr}</span>
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
        try {
            if (index < 0) index = 0;
            if (index > flatMoves.length) index = flatMoves.length;
            renderer.reset();
            for (let i = 0; i < index; i++) {
                const move = flatMoves[i];
                if (move) chess.move({ from: move.from, to: move.to, promotion: move.promotion });
            }
            renderer.draw();
            const infoEl = document.getElementById('moveInfo');
            if (infoEl) infoEl.innerText = index === 0 ? 'Bàn cờ ban đầu' : `Nước đi: ${index}/${flatMoves.length}`;
            // optional: disable/enable buttons
            const prevBtn = document.getElementById('prevBtn');
            const nextBtn = document.getElementById('nextBtn');
            if (prevBtn) prevBtn.disabled = index === 0;
            if (nextBtn) nextBtn.disabled = index === flatMoves.length;
        } catch (err) {
            console.error('Replay showMove error:', err);
            alert('Lỗi khi phát lại ván đấu (xem console).');
        }
    }
    document.getElementById('nextBtn').onclick = () => {
        if (moveIndex < flatMoves.length) {
            moveIndex++;
            showMove(moveIndex);
            // Play sound for the move
            if (moveIndex > 0 && flatMoves[moveIndex - 1] && window.Sound) {
                window.Sound.playMove(flatMoves[moveIndex - 1]);
            }
        }
    };
    document.getElementById('prevBtn').onclick = () => {
        if (moveIndex > 0) {
            // Play sound for the move we're going back to see
            const prevMove = flatMoves[moveIndex - 1];
            moveIndex--;
            showMove(moveIndex);
            if (prevMove && window.Sound) {
                window.Sound.playMove(prevMove);
            }
        }
    };

    showMove(moveIndex);
}