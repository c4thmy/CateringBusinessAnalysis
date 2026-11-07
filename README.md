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

//tag：给当前工程状态打标签，方便之后查找
git tag -a v0.1.0 -m "说明这个版本的状态"   # 在当前提交上打附注标签
git push origin v0.1.0                        # 推送标签到 GitHub（git push 默认不推标签）

git tag -n                  # 列出所有标签及说明
git show v0.1.0             # 查看标签对应的提交内容
git diff v0.1.0 main        # 对比标签时的状态和现在的差异
git checkout v0.1.0         # 临时切回该状态查看，看完用 git checkout main 回来

已有标签：
- v0.1.0：初始基线，业务参考资料(docs) + OpenSpec 脚手架 + CLAUDE.md，尚无源代码
- v0.2.0：经营分析系统 OpenSpec 规划完成（change: build-catering-analysis-platform），待审批，尚无源代码


## openspec opt
OpenSpec 是 Fission AI 出品的规格驱动开发（SDD）框架，项目地址：https://github.com/Fission-AI/OpenSpec
npm install -g @fission-ai/openspec@1.16.0   # 固定版本；想装最新版改成 @latest

openspec --version

npm install -g @fission-ai/openspec@latest
cd your-project
openspec update 

cd your-project
openspec init