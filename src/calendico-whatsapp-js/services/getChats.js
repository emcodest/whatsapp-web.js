const { getClient } = require('./../clients/ClientsConnected');
const { extractNumber } = require('../utils/utilities');
const {getClientInitializing, addClientInitializing} = require('../clients/ClientsInitializingSession');
const {initializeWhatsAppClient} = require('./whatsappService');

async function getChats(location_identifier, chats_to_get, res, return_raw_chats = false) {
    if (!location_identifier) {
        return res.status(400).json({success: false, message: 'The location identifier is required'});
    }

    try {
        const client = getClient(location_identifier);
        if (!client) {
            if (getClientInitializing(location_identifier)) {
                console.log('============================================');
                console.log('Client is initializing...');
                console.log('============================================');
                if (return_raw_chats) {
                    return false
                } else {
                    return res.status(400).json({
                        success: false,
                        message: 'Client is already initializing. Please try again in a few seconds.'
                    });
                }
            }
            if (return_raw_chats) {
                return false
            } else {
                return res.status(400).json({
                    success: false,
                    message: `getChats: There is no client with this location_identifier: ${location_identifier}`
                });
            }
        }
        else {
            const chats = await client.getChats().catch(async (error) => {
                console.error('Error getting chats:', error);
                addClientInitializing(location_identifier, client);
                await initializeWhatsAppClient(location_identifier);
                if (return_raw_chats) {
                    return false
                } else {
                    return res.status(500).json({success: false, message: 'Error getting client`s chats'});
                }
            });
            if (return_raw_chats) {
                return chats;
            }
            console.log('============================================');
            console.log(`There are ${chats.length} chats`);
            //raise error if chats is undefined
            if (chats === undefined) {
                return res.status(400).json({success: false, message: 'We cannot get the chats at this moment. Please try again later'});
            }
            createChatJSONObject(chats, Number(chats_to_get))
                .then(chatJSONObject => {
                    return res.status(200).json({code: 200, status: 'success', body: chatJSONObject});
                })
                .catch(error => {
                    console.error('Error creating chat JSON object:', error);
                    res.status(500).json({success: false, message: `Error creating chat JSON object: ${error}`});
                });
        }
    } catch (error) {
        console.error('Error in getChats process:', error);
        res.status(500).json({success: false, message: 'Error during getChats process'});
    }
}

function createChatJSONObject(chats, chats_to_get) {
    return Promise.all(chats.map(chat => {
        return chat.fetchMessages({limit: Number(chats_to_get)})
            .then(messages => {
                return {
                    chatName: chat.name,
                    groupChat: chat.isGroup,
                    messages: messages.map(message => {
                        return {
                            from: extractNumber(message.from),
                            fromMe: message.fromMe,
                            body: message.body
                        };
                    })
                };
            });
    }))
        .then(chatsWithMessages => {
            let chatJSONObject = {};
            chatsWithMessages.forEach(chat => {
                chatJSONObject[chat.chatName] = {groupChat: chat.groupChat, messages: chat.messages};
            });
            return chatJSONObject;
        });
}

module.exports = { getChats };