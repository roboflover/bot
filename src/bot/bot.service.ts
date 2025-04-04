import { Injectable } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';

const trainingSlots = ['09:00', '12:00', '15:00', '18:00'];
const flightModes = ['Режим 1', 'Режим 2', 'Режим 3', 'Режим 4'];

@Injectable()
export class BotService {
  // private token = process.env.TELEGRAM_BOT_TOKEN || '';
  private token = "8023215234:AAFkF9YReVrH1FQa0dlrEnBXn2SAdnJ6YSg";
  public bot: TelegramBot;

  constructor() {
    this.bot = new TelegramBot(this.token, { polling: true });
    this.registerCommands();
  }

  registerCommands() {
    // Команда /start
    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      this.showTrainingSlotKeyboard(chatId);
    });

    // Обработка нажатий на кнопки
    this.bot.on('callback_query', async (query) => {
      const { data, message } = query;

      switch (data) {
        case 'select_slot': // Когда нажимают "Выбрать слот тренировки"
          await this.selectTrainingSlot(query); // Переходим к выбору слота
          break;
        case /^slot_/i: // Когда выбирают конкретный слот (например, 'slot_09:00')
          await this.selectFlightMode(query); // Переходим к выбору режима полёта
          break;
        case /^mode_/i: // Когда выбирают режим полёта (например, 'mode_Режим_1')
          await this.bookTraining(query); // Переходим к подтверждению записи
          break;
        case 'book_training':
          await this.confirmBooking(query); // Подтверждаем запись
          break;
        default:
          console.log(`Unknown callback data: ${data}`);
      }
    });
  }

  // Показываем клавиатуру для выбора слота тренировки
  showTrainingSlotKeyboard(chatId: number) {
    const keyboard = [
      [{ text: 'Выбрать слот тренировки', callback_data: 'select_slot' }]
    ];
    const options = {
      reply_markup: JSON.stringify({
        inline_keyboard: keyboard
      })
    };
    this.bot.sendMessage(chatId, 'Пожалуйста, выберите слот тренировки:', options);
  }

  // Обрабатываем выбор слота тренировки
  async selectTrainingSlot(query: TelegramBot.CallbackQuery) {
    const { message } = query;
    const chatId = message.chat.id;
    const slotKeyboard = trainingSlots.map(slot => ({
      text: slot,
      callback_data: `slot_${slot}` // Сохраняем выбранный слот
    }));
    const options = {
      reply_markup: JSON.stringify({
        inline_keyboard: [slotKeyboard]
      })
    };
    await this.bot.editMessageText('Выберите слот тренировки:', {
      chat_id: chatId,
      message_id: message.message_id,
      ...options
    });
  }

  // Обрабатываем выбор режима полёта
  async selectFlightMode(query: TelegramBot.CallbackQuery) {
    const { message } = query;
    const chatId = message.chat.id;
    const modeKeyboard = flightModes.map(mode => ({
      text: mode,
      callback_data: `mode_${mode.replace(/\s/g, '_')}` // Сохраняем выбранный режим
    }));
    const options = {
      reply_markup: JSON.stringify({
        inline_keyboard: [modeKeyboard]
      })
    };
    await this.bot.editMessageText('Выберите режим полёта:', {
      chat_id: chatId,
      message_id: message.message_id,
      ...options
    });
  }

  // Обрабатываем запись на тренировку
  async bookTraining(query: TelegramBot.CallbackQuery) {
    const { message } = query;
    const chatId = message.chat.id;
    const keyboard = [[{
      text: 'Записаться на тренировку',
      callback_data: 'book_training'
    }]];
    const options = {
      reply_markup: JSON.stringify({
        inline_keyboard: keyboard
      })
    };
    await this.bot.editMessageText('Подтверждаете запись на тренировку?', {
      chat_id: chatId,
      message_id: message.message_id,
      ...options
    });
  }

  // Подтверждение записи
  async confirmBooking(query: TelegramBot.CallbackQuery) {
    const { message } = query;
    const chatId = message.chat.id;
    await this.bot.editMessageText('Запись на тренировку подтверждена!', {
      chat_id: chatId,
      message_id: message.message_id
    });
  }
}