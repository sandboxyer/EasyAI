import Chat from "./Chat.js";

class ChatModule {
    constructor(){
        this.Chats = [new Chat()]
        this.Chats.splice(0,1)
    }

    NewChat(name = 'New Chat',config = {historical : undefined,id : undefined}){
        this.Chats.push(new Chat(name,config))
    }

    NewMessage(chatindex,sender,content,config = {id : undefined,time : false}){
        this.Chats[chatindex].NewMessage(sender,content,config = {id : undefined,time : false})

    }
 
    GetChatHistorical(index){
        return this.Chats[index].Historical
    }

}

export default ChatModule