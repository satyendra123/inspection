CI/CD Setup (Auto Deploy + Obfuscation)

1. Workflow file: `.github/workflows/deploy.yml`
2. Build script: `scripts/build-obfuscated.mjs`
3. Command: `npm run build:release`

What pipeline does on each push (`main`/`master`):
1. `npm install`
2. `npm test`
3. `javascript-obfuscator` se `app.js`, `Controller`, `Model`, `middleware`, `Router`, `config`, `utils` obfuscate karta hai
4. `dist/` package banata hai
5. Server pe upload + deploy karta hai
6. `npm install --omit=dev` run karke app restart karta hai

GitHub Secrets required:
1. `SERVER_HOST` = .2010
2. `SERVER_USER` = root
3. `SERVER_PASSWORD` =
4. `SERVER_PORT` = 22
5. `SERVER_APP_DIR` = /var/www/backend
6. `SERVER_RESTART_COMMAND` = pm2 restart app

Example restart command:
`pm2 restart mybackend || pm2 start app.js --name mybackend`

Important:
- `.env` repo me commit mat karo.
- Server pe runtime `.env` alag se maintain karo.
- Agar custom restart chahiye to `SERVER_RESTART_COMMAND` secret set karo.
- Pipeline server par `/tmp/dist.zip` upload karta hai aur `$SERVER_APP_DIR/dist` me unzip karta hai.
>

npm run build:release
scp -P 22 D:\MYproject\Inspection management\MyBackend\dist.zip root@150.241.245.209:/var/www/backend/dist.zip
powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Path '.\dist\*' -DestinationPath '.\dist.zip' -Force"
scp -P 22 D:\MYproject\Inspection management\TailAdmin-1.0.0\dist.zip root@150.241.245.209:/var/www/html/dist.zip
scp -P 22 ".\dist.zip" root@150.241.245.209:/var/www/backend/dist.zip
pscp -P 22 -i "D:\personal\server.ppk" "D:\MYproject\Inspection management\MyBackend\app.js" root@150.241.245.209:/var/www/backend/app.js
pscp -P 22 -i "D:\personal\server.ppk" "D:\MYproject\Inspection management\TailAdmin-1.0.0\dist.zip" root@103.51.216.249:/var/www/html/
pscp -scp -P 22 -i "D:\personal\server.ppk" "D:\MYproject\Inspection management\TailAdmin-1.0.0\dist.zip" ubuntu@103.51.216.249:/home/ubuntu/
