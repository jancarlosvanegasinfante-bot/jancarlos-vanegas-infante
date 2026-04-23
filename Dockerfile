# Usamos una imagen ligera de Node.js
FROM node:20-slim

# Directorio de trabajo
WORKDIR /app

# Copiamos archivos de dependencias
COPY package.json package-lock.json* ./

# Instalamos dependencias de producción
RUN npm install

# Copiamos el resto del código
COPY . .

# Construimos el frontend
RUN npm run build

# Exponemos el puerto que usa Cloud Run (8080 por defecto, pero configuramos 3000)
EXPOSE 3000

# Comando para arrancar el servidor
# Usamos tsx para ejecutar el server.ts directamente en producción (compatible con Node 20+)
CMD ["npm", "start"]
