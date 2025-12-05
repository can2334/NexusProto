function createDeck() {
    const suits = ["❤️", "♦️", "♣️", "♠️"];
    const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
    let deck = [];

    for (let suit of suits) {
        for (let rank of ranks) {
            deck.push({ suit, rank });
        }
    }
    return deck;
}

function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function dealCard(deck) {
    let card = deck.pop();
    return card;
}

function cardValue(card) {
    if (["J", "Q", "K"].includes(card.rank)) return 10;
    if (card.rank === "A") return 11; // Ace starts as 11
    return parseInt(card.rank, 10);
}

function calculateHandValue(hand) {
    let total = 0;
    let aces = 0;

    for (let card of hand) {
        total += cardValue(card);
        if (card.rank === "A") aces++;
    }

    while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
    }
    return total;
}

function displayHand(hand) {
    return hand.map(card => `${card.suit} ${card.rank} `).join(", ");
}

async function sendMsg(groupId, msg, sock, rawMessage, text) {
    let key = database.games.blackjack[msg.key.remoteJid]?.msgkey;

    if (key && !database.games.blackjack[msg.key.remoteJid].newMsg) {
        return await sock.sendMessage(msg, { text, edit: key });
    } else {
        return await sock.sendMessage(msg, { text, quoted: rawMessage.messages[0] });
    }
}

async function updateGameState(gameState, groupId, msg, sock, rawMessage) {
    let message = `🃏 *Your hand:* ${displayHand(gameState.playerHand)} (Total: ${gameState.playerTotal})\n`;
    message += `🎩 *Dealer shows:* ${displayHand([gameState.dealerHand[0]])} ?\n`;

    if (gameState.isPlayerTurn) {
        message += "🤔 What's your move? Type *'hit'* to draw a card or *'stand'* to hold your position.";
    }

    const pbl = await sendMsg(groupId, msg, sock, rawMessage, message);

    if (!global.database.games.blackjack[msg.key.remoteJid].msgkey) {
        global.database.games.blackjack[groupId].messageId = pbl.key.id;
        global.database.games.blackjack[groupId].msgkey = pbl.key;
    }
}

addCommand({ pattern: "^blackjack$", access: "all", desc: "Start a game of Blackjack!" }, async (msg, match, sock, rawMessage) => {
    const groupId = msg.key.remoteJid;
    const playerId = msg.key.fromMe ? sock.user.id.split(':')[0] + "@s.whatsapp.net" : (msg.key.participant ? msg.key.participant : msg.key.remoteJid);

    if (!global.database.games) global.database.games = {};
    if (!global.database.games.blackjack) global.database.games.blackjack = {};

    if (!global.database.games.blackjack[groupId]) {
        const deck = shuffle(createDeck());
        const playerHand = [dealCard(deck), dealCard(deck)];
        const dealerHand = [dealCard(deck), dealCard(deck)];

        global.database.games.blackjack[groupId] = {
            player: playerId,
            remoteJid: msg.key.remoteJid,
            deck,
            playerHand,
            dealerHand,
            playerTotal: calculateHandValue(playerHand),
            dealerTotal: calculateHandValue(dealerHand),
            isPlayerTurn: true,
            isGameOver: false,
            msgkey: undefined,
            newMsg: false,
        };
    }

    const gameState = global.database.games.blackjack[groupId];
    await updateGameState(gameState, groupId, msg, sock, rawMessage);
});

addCommand({ pattern: "onMessage", access: "all", dontAddCommandList: true }, async (msg, match, sock, rawMessage) => {
    const groupId = msg.key.remoteJid;
    const currentPlayerId = msg.key.fromMe ? sock.user.id.split(':')[0] + "@s.whatsapp.net" : (msg.key.participant ? msg.key.participant : msg.key.remoteJid);

    if (!global.database.users) global.database.users = {};
    if (!global.database.users[currentPlayerId]) {
        global.database.users[currentPlayerId] = {};
    }


    if (global.database?.games?.blackjack[groupId] && global.database.games.blackjack[groupId].player === currentPlayerId) {
        const gameState = global.database.games.blackjack[groupId];

        if (!gameState.isGameOver) {
            const action = msg.text.trim().toLowerCase();

            if (["hit", "stand"].includes(action)) {

                const handlePlayerAction = async (action) => {
                    if (action === "hit") {
                        const card = dealCard(gameState.deck);
                        gameState.playerHand.push(card);
                        gameState.playerTotal = calculateHandValue(gameState.playerHand);

                        await sendMsg(groupId, msg, sock, rawMessage,
                            `🎴 You drew: ${card.rank} of ${card.suit}\n🃏 *Your hand:* ${displayHand(gameState.playerHand)} (Total: ${gameState.playerTotal})`);

                        if (gameState.playerTotal > 21) {
                            gameState.isGameOver = true;
                            await sendMsg(groupId, msg, sock, rawMessage,
                                `🎭 *Dealer's hand:* ${displayHand(gameState.dealerHand)} (Total: ${gameState.dealerTotal})\n 🃏 *Your hand:* ${displayHand(gameState.playerHand)} (Total: ${gameState.playerTotal})\n💥 Bust! You went over 21. Dealer wins.`);
                            delete global.database.games.blackjack[groupId];
                            return;
                        }
                    } else if (action === "stand") {
                        gameState.isPlayerTurn = false;
                    }

                    await updateGameState(gameState, groupId, msg, sock, rawMessage);
                };

                await handlePlayerAction(action);

                if (!gameState.isPlayerTurn && !gameState.isGameOver) {
                    const handleDealerTurn = async () => {
                        while (calculateHandValue(gameState.dealerHand) < 17) {
                            const card = dealCard(gameState.deck);
                            gameState.dealerHand.push(card);
                            gameState.dealerTotal = calculateHandValue(gameState.dealerHand);
                        }
                        gameState.isGameOver = true;

                        let message = `🎭 *Dealer's hand:* ${displayHand(gameState.dealerHand)} (Total: ${gameState.dealerTotal})\n 🃏 *Your hand:* ${displayHand(gameState.playerHand)} (Total: ${gameState.playerTotal})`;
                        if (gameState.dealerTotal > 21) {
                            message += "🚀 Dealer busts! You win! 🎉";
                        } else if (gameState.dealerTotal > gameState.playerTotal) {
                            message += "🏆 Dealer wins!";
                        } else if (gameState.dealerTotal < gameState.playerTotal) {
                            message += "🎊 You win!";
                        } else {
                            message += "🤝 It's a tie!";
                        }
                        await sendMsg(groupId, msg, sock, rawMessage, message);
                        delete global.database.games.blackjack[groupId];
                    };
                    await handleDealerTurn();
                }
            }
        }
    }
});
