import { Injectable } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class BotService {
  private token = process.env.TELEGRAM_BOT_TOKEN || '';
  public bot: TelegramBot;

  constructor() {
    this.bot = new TelegramBot(this.token, { polling: true });
    this.registerCommands();
  }

  registerCommands() {
    // Регистрация команд
    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      this.bot.sendMessage(chatId, 'Привет! Я твой бот.');
    });
    
    // Меню
    this.bot.on('callback_query', async (query) => {
      const { data, message } = query;
      
      if (data === 'option1') {
        await this.bot.editMessageText(
          'Вы выбрали опцию 1',
          {
            chat_id: message.chat.id,
            message_id: message.message_id,
          },
        );
      } else if (data === 'option2') {
        await this.bot.editMessageText(
          'Вы выбрали опцию 2',
          {
            chat_id: message.chat.id,
            message_id: message.message_id,
          },
        );
      }
    });
  }
}