import { Injectable } from '@nestjs/common'
import * as TelegramBot from 'node-telegram-bot-api';
import * as fs from 'fs'; // Модуль для работы с файловой системой
import * as path from 'path'; // Для работы с путями
import { join } from 'path';
import { cwd } from 'process';

const trainingSlots = ['12.04 Сб 20:00-22:00', '19.04 Суб 21:00-22.00', '26.04 Сб 20:00-22:00', '03.05 Суб 20:00-22.00'];
const flightModes = ['R/L-1', 'R/L-2', 'R/L-3', 'R/L-4'];

// Объект для хранения состояния пользователя
interface UserState {
  userId: number;
  selectedSlot?: any;
  selectedUsername?: any; // Добавленное поле для имени пользователя
  selectedMode?: any;
}

@Injectable()
export class BotService {
  
  private token = "8023215234:AAFkF9YReVrH1FQa0dlrEnBXn2SAdnJ6YSg";
  public bot: TelegramBot;

  // Путь к файлу CSV
  // private csvFilePath = path.resolve(__dirname, 'test_results.csv');
// Путь к CSV файлу в корне проекта
private csvFilePath = join(cwd(), 'test_results.csv');

  // Глобальное хранилище состояний пользователей
  private userStates: Record<number, UserState> = {};

  constructor() {
    this.bot = new TelegramBot(this.token, { polling: true });
    this.initializeCsvFile(); // Создаём файл, если его нет
    this.registerCommands();
  }

  private resetUserState(chatId: number) {
    this.userStates[chatId] = { userId: chatId }; // Сбрасываем состояние пользователя
}

  // Инициализация файла CSV
  private initializeCsvFile() {
    if (!fs.existsSync(this.csvFilePath)) {
      try {
        const header = 'Номер записи,Имя пользователя,Дата,ID пользователя,Слот тренировки,Режим полёта\n';
        fs.writeFileSync(this.csvFilePath, header, { encoding: 'utf8' });
        console.log(`Файл CSV успешно создан: ${this.csvFilePath}`);
      } catch (error) {
        console.error(`Ошибка при создании файла CSV: ${error}`);
      }
    } else {
      console.log(`Файл CSV уже существует: ${this.csvFilePath}`);
    }
  }

  // Записываем данные в CSV
  private saveToCsv(userId: number, username: string, slot: string, mode: string) {
    const date = new Date().toISOString(); // Текущая дата и время
    const lines = fs.readFileSync(this.csvFilePath, { encoding: 'utf8' }).split('\n'); // Читаем файл для получения номера записи
    const recordNumber = lines.length - 1; // Индекс текущей строки минус заголовок
    const row = `${recordNumber},${username},${date},${userId},${slot},${mode}\n`;
    
    try {
      fs.appendFileSync(this.csvFilePath, row, { encoding: 'utf8' }); // Добавляем строку в файл
      console.log(`Запись в CSV выполнена: ${row}`);
    } catch (error) {
      console.error(`Ошибка записи в CSV: ${error}`);
    }
  }

  // Читаем данные пользователя из CSV
  private getUserRecords(userId: number): { index: number, record: string }[] {
    const records: { index: number, record: string }[] = [];
    const fileContent = fs.readFileSync(this.csvFilePath, { encoding: 'utf8' }).split('\n');
    for (let i = 1; i < fileContent.length; i++) { // Начинаем с 1, пропускаем заголовок
      const parts = fileContent[i].split(',');
      if (parts.length >= 6 && parseInt(parts[3]) === userId) {
        records.push({ index: i, record: fileContent[i] });
      }
    }
    return records;
  }

  // Удаляем запись пользователя из CSV
  private deleteRecord(index: number) {
    const fileContent = fs.readFileSync(this.csvFilePath, { encoding: 'utf8' }).split('\n');
    if (index > 0 && index < fileContent.length) {
      fileContent.splice(index, 1); // Удаляем строку
      fs.writeFileSync(this.csvFilePath, fileContent.join('\n'), { encoding: 'utf8' });
      console.log(`Запись удалена: ${fileContent[index]}`);
    } else {
      console.error(`Неверный индекс записи: ${index}`);
    }
  }

  registerCommands() {
    // Команда /start
    this.bot.onText(/start/, (msg) => {
      const chatId = msg.chat.id;
      
      console.log(`Пользователь начал диалог: ID=${chatId}`);
      this.userStates[chatId] = { userId: chatId }; // Создаем новый объект для данного пользователя
      this.showMainMenu(chatId);
    });

    // Обработка нажатий на кнопки
    this.bot.on('callback_query', async (query) => {
      const { data, message } = query;
      
      if (!data || !message) {
        console.warn("Получены пустые данные в callback_query");
        return;
      }

      const chatId = message.chat.id;
      let userState = this.userStates[chatId];

      if (!userState) {
        console.warn(`Нет состояния для пользователя с ID=${chatId}`);
        return;
      }

      if (data === 'show_records') {
        // Отображаем список записей пользователя
        await this.showUserRecords(chatId);
      } else if (data.startsWith('delete_record')) {
        // Удаляем указанную запись
        const parts = data.split('_');
        const index = parseInt(parts[parts.length - 1]);
        await this.deleteUserRecord(chatId, index);
      } else if (data === 'select_slot') {
        // Когда нажимают "Выбрать слот тренировки"
        await this.selectTrainingSlot(query);
      } else if (data === 'view_registered_users') {
        // Просмотр списка записавшихся участников
        await this.showRegisteredUsers(chatId);
      } else if (/^slot_/.test(data)) {
        // Когда выбирают конкретный слот
        userState.selectedSlot = data.replace('slot_', '');
        await this.askForUsername(chatId, userState);
      } else if (/^mode_/.test(data)) {
        // Когда выбирают режим полёта
        userState.selectedMode = data.replace('mode_', '').replace(/_/g, ' ');
        await this.bookTraining(query, userState.selectedSlot, userState.selectedUsername, userState.selectedMode);
      } else {
        console.log(`Неизвестная команда: ${data}`);
      }

    });
  }

  private showMainMenu(chatId: number) {
    const keyboard = [
      [{ text: 'Посмотреть мои записи', callback_data: 'show_records' }],
      [{ text: 'Выбрать слот тренировки', callback_data: 'select_slot' }],
      [{ text: 'Просмотреть список записавшихся', callback_data: 'view_registered_users' }], // Новая кнопка
    ];
    const options = { reply_markup: JSON.stringify({ inline_keyboard: keyboard }) };
    this.bot.sendMessage(chatId, 'Главное меню:', options);
    console.log(`Показано главное меню: ID=${chatId}`);
  }

  private async selectTrainingSlot(query: TelegramBot.CallbackQuery) {
    const { message } = query;
    const chatId = message.chat.id;

    const slotKeyboard = trainingSlots.map(slot => ({
      text: slot,
      callback_data: `slot_${slot}` // Сохраняем выбранный слот
    }));

    const options = { reply_markup: JSON.stringify({ inline_keyboard: [slotKeyboard] }) };
    await this.bot.editMessageText('Выберите слот тренировки:', {
      chat_id: chatId,
      message_id: message.message_id,
      ...options,
    });
    console.log(`Предложено выбрать слот тренировки: ID=${chatId}`);
}

private async askForUsername(chatId: number, userState: UserState) {
  await this.bot.sendMessage(chatId, 'Пожалуйста, введите ваше имя:');

  // Функция-обработчик сообщения
  const onMessageHandler = async (msg) => {
      if (msg.chat.id !== chatId) return; // Проверяем, что сообщение пришло от нужного пользователя
      const enteredName = msg.text;
      
      if (enteredName) {
          userState.selectedUsername = enteredName;
          
          // Остановим прослушивание сообщений
          this.bot.removeListener('message', onMessageHandler);
          
          await this.selectFlightMode(msg, userState.selectedSlot);
      } else {
          await this.bot.sendMessage(chatId, 'Пожалуйста, введите ваше имя.');
      }
  };

  // Регистрация события on('message')
  this.bot.on('message', onMessageHandler);
}

  // Обрабатываем выбор режима полёта
  private async selectFlightMode(message: TelegramBot.Message, selectedSlot: string) {
    const chatId = message.chat.id;
    const modeKeyboard = flightModes.map(mode => ({
      text: mode,
      callback_data: `mode_${mode.replace(/s/g, '_')}` // Сохраняем выбранный режим
    }));

    const options = { reply_markup: JSON.stringify({ inline_keyboard: [modeKeyboard] }) };
    console.log('options', options)
    await this.bot.sendMessage(chatId, `Вы выбрали слот ${selectedSlot}. Теперь выберите режим полёта:`, options);
    console.log(`Предложено выбрать режим полета: ID=${chatId}, слот=${selectedSlot}`);
  }

  // Подтверждаем запись на тренировку
  private async bookTraining(query: TelegramBot.CallbackQuery, selectedSlot: string, selectedUsername: string, selectedMode: string) {
    const { message } = query;
    const chatId = message.chat.id;
  
    // Получаем объект состояния пользователя
    const userState = this.userStates[chatId];
  
    if (!userState) {
      await this.bot.sendMessage(chatId, 'Ошибка! Сначала выберите слот.');
      console.error(`Ошибка подтверждения записи: слот не выбран`);
      return;
    }
  
    // Проверяем, доступен ли слот
    if (!this.checkSlotAvailability(selectedSlot)) {
      await this.bot.sendMessage(chatId, `К сожалению, слот "${selectedSlot}" уже заполнен. Попробуйте выбрать другой.`);
      return;
    }
  
    // Сохраняем данные в CSV
    this.saveToCsv(chatId, selectedUsername, selectedSlot, selectedMode);
  
    await this.bot.editMessageText(
      `Вы выбрали режим ${selectedMode}. Ваша запись подтверждена!`,
      { chat_id: chatId, message_id: message.message_id }
    );
    console.log(`Подтверждение записи выполнено: ID=${chatId}, слот=${selectedSlot}, режим=${selectedMode}`);
  }

  // Показываем записи пользователя
  private async showUserRecords(chatId: number) {
    const userState = this.userStates[chatId];
    if (!userState) {
      await this.bot.sendMessage(chatId, 'Нет активных записей.');
      return;
    }

    const records = this.getUserRecords(userState.userId);
    if (records.length === 0) {
      await this.bot.sendMessage(chatId, 'У вас нет активных записей.');
      return;
    }

    const message = `Ваши текущие записи:\n\n${records.map(r => `#${r.index}: ${r.record}`).join('\n')}`;
    await this.bot.sendMessage(chatId, message, {
      reply_markup: JSON.stringify({
        inline_keyboard: records.map(({ index }) => [
          { text: `Удалить запись #${index}`, callback_data: `delete_record_${index}` }
        ])
      })
    });
    console.log(`Отображены записи пользователя: ID=${chatId}`);
  }

  // Удаляем запись пользователя
  private async deleteUserRecord(chatId: number, recordIndex: number) {
    const userState = this.userStates[chatId];
    if (!userState) {
      await this.bot.sendMessage(chatId, 'Нет активных записей.');
      return;
    }

    const records = this.getUserRecords(userState.userId);
    if (recordIndex <= 0 || recordIndex > records.length) {
      await this.bot.sendMessage(chatId, 'Указанная запись не найдена.');
      return;
    }

    this.deleteRecord(recordIndex);
    await this.bot.sendMessage(chatId, `Запись №${recordIndex} удалена.`);
    console.log(`Запись пользователя удалена: ID=${chatId}, индекс=${recordIndex}`);
  }

  private async showRegisteredUsers(chatId: number) {
    // Чтение всех записей из CSV-файла
    const allRecords = fs.readFileSync(this.csvFilePath, { encoding: 'utf8' }).split('\n').slice(1); // Пропускаем первую строку (заголовки)
  
    // Подготовка массива для хранения информации о слотах и участниках
    const registeredUsersBySlot: Record<string, string[]> = {};
  
    for (const record of allRecords) {
      const parts = record.split(',');
      if (parts.length >= 5) {
        const slot = parts[4]; // Предполагаем, что слот находится в пятом столбце
        const username = parts[1]; // Имя пользователя находится во втором столбце
        if (registeredUsersBySlot[slot]) {
          registeredUsersBySlot[slot].push(username);
        } else {
          registeredUsersBySlot[slot] = [username];
        }
      }
    }
  
    // Форматируем сообщение с информацией о слотах и участниках
    let messageText = 'Список записавшихся участников:\n';
    for (const slot in registeredUsersBySlot) {
      messageText += `\n**${slot}:**\n`;
      for (const username of registeredUsersBySlot[slot]) {
        messageText += `- ${username}\n`;
      }
    }
  
    // Отправка сообщения пользователю
    await this.bot.sendMessage(chatId, messageText, { parse_mode: 'Markdown' });
    console.log(`Отправлено сообщение с информацией о записавшихся участниках: ID=${chatId}`);
  }

  private checkSlotAvailability(slot: string): boolean {
    // Чтение всех записей из CSV-файла
    const allRecords = fs.readFileSync(this.csvFilePath, { encoding: 'utf8' }).split('\n').slice(1); // Пропускаем первую строку (заголовки)
  
    // Подсчитываем количество участников для выбранного слота
    let participantsCount = 0;
    for (const record of allRecords) {
      const parts = record.split(',');
      if (parts.length >= 5 && parts[4] === slot) {
        participantsCount++;
      }
    }
  
    // Возвращаем true, если слот доступен (менее 4 участников), иначе false
    return participantsCount < 4;
  }

  
}

