# Используем официальный образ Node.js версии 20.1.0
FROM node:20.1.0

# Устанавливаем рабочую директорию внутри контейнера
WORKDIR /app

# Копируем package.json и package-lock.json в контейнер
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем все файлы проекта в контейнер
COPY . .

# Собираем приложение Nest.js (если используется TypeScript)
RUN npm run build

# Указываем порт, который будет использоваться приложением
EXPOSE 3000

# Команда запуска приложения
CMD ["npm", "run", "start:prod"]
