@echo off
echo Starting Shop Master...
set PORT=5001
cd client && set PORT=3001 && cd ..
npm run dev
pause 