import { Injectable } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import * as fs from 'fs'; // Модуль для работы с файловой системой
import * as path from 'path'; // Для работы с путями

// Тренировочные слоты
const trainingSlots = ['09:00', '12:00', '15:00', '18:00'];

// Режимы полёта
const flightModes = ['Режим 1', 'Режим 2', 'Режим 3', 'Режим 4'];

@Injectable()
export class BotService {
  private token = "8023215234:AAFkF9YReVrH1FQa0dlrEnBXn2SAdnJ6YSg"; // Ваш токен
  public bot: TelegramBot;

  // Путь к файлу CSV
  private csvFilePath = path.resolve(__dirname, 'test_results.csv');

  // Текущие выбранные параметры
  private selectedSlot: string | null = null;
  private selectedMode: string | null = null;

  constructor() {
    this.bot = new TelegramBot(this.token, { polling: true });
    this.initializeCsvFile(); // Создаем файл, если его нет
    this.registerCommands();
  }

  // Инициализация файла CSV
  private initializeCsvFile() {
    if (!fs.existsSync(this.csvFilePath)) {
      const header = 'Дата,ID пользователя,Слот тренировки,Режим полёта\n';
      fs.writeFileSync(this.csvFilePath, header, { encoding: 'utf8' });
    }
  }

  // Регистрация команд
  private registerCommands() {
    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      this.bot.sendMessage(chatId, `Привет! Давай начнем настройку тренировки.\nВыбери тренировочный слот:`);
      this.displayTrainingSlots(chatId);
    });

    this.bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text || '';

      switch (true) {
        case trainingSlots.includes(text):
          this.selectedSlot = text;
          this.bot.sendMessage(chatId, `Тренировочный слот "${this.selectedSlot}" выбран.\nТеперь выбери режим полёта:`);
          this.displayFlightModes(chatId);
          break;
        case flightModes.includes(text):
          this.selectedMode = text;
          await this.saveDataToCSV(msg.from.id); // Сохраняем данные в CSV
          this.bot.sendMessage(chatId, `Готово! Твоя тренировка запланирована.`);
          this.resetSelectedParams(); // Сбрасываем выбранные параметры
          break;
        default:
          this.bot.sendMessage(chatId, 'Не понял тебя. Попробуй еще раз.');
      }
    });
  }

  // Отображение тренировочных слотов
  private displayTrainingSlots(chatId: number) {
    let message = 'Доступные тренировочные слоты:\n';
    for (let i = 0; i < trainingSlots.length; i++) {
      message += `${i + 1}. ${trainingSlots[i]}\n`;
    }
    this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  }

  // Отображение режимов полёта
  private displayFlightModes(chatId: number) {
    let message = 'Доступные режимы полёта:\n';
    for (let i = 0; i < flightModes.length; i++) {
      message += `${i + 1}. ${flightModes[i]}\n`;
    }
    this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  }

  // Запись данных в CSV-файл
  private saveDataToCSV(userId: number) {
    const date = new Date().toISOString();
    const data = `${date},${userId},${this.selectedSlot},${this.selectedMode}\n`;
    fs.appendFileSync(this.csvFilePath, data, { encoding: 'utf8' });
  }

  // Сброс выбранных параметров
  private resetSelectedParams() {
    this.selectedSlot = null;
    this.selectedMode = null;
  }
}