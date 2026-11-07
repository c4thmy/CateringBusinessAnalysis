# CateringBusinessAnalysis

## git opt
https://github.com/c4thmy/CateringBusinessAnalysis.git

//…or create a new repository on the command line
echo "# CateringBusinessAnalysis" >> README.md
git init
git add README.md
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/c4thmy/CateringBusinessAnalysis.git
git push -u origin main

//…or push an existing repository from the command line
git remote add origin https://github.com/c4thmy/CateringBusinessAnalysis.git
git branch -M main
git push -u origin main

//change
git pull
git add .
git commit -m "docs"
git push -u origin main 

git status


## openspec opt
OpenSpec 是 Fission AI 出品的规格驱动开发（SDD）框架，项目地址：https://github.com/Fission-AI/OpenSpec
npm install -g @fission-ai/openspec@1.16.0   # 固定版本；想装最新版改成 @latest

openspec --version

npm install -g @fission-ai/openspec@latest
cd your-project
openspec update 

cd your-project
openspec init