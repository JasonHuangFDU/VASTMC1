# 1.VUE代码运行

## 1.1 准备开发环境
- 下载安装Node.js:[Node.js官方网站](https://nodejs.org/zh-cn)
- 验证安装：在终端输入`npm -v` `node -v`，输出版本号后说明安装成功

## 1.2 安装依赖
这一步如果直接将整个库pull到本地理论上不需要，不过再做一次也无妨
- 在project目录下`cd oceanus-weaver`
- 安装项目所需的所有基础库`npm install`
- 安装 D3.js`npm install d3`

## 1.3 运行
在相同目录下运行`npm run dev`

# 2. 代码框架说明
结构树如下：
```
/src
|
|-- /assets
| |-- MC1_graph.json      # 我们的原始数据文件
|
|-- /components
| |-- /controls
| | |-- ControlPanel.vue    # 包含所有过滤器的控制面板
| | |-- DetailsPanel.vue    # 显示选中节点详细信息的面板
| | |-- SearchBar.vue       # 搜索艺术家、歌曲等的组件
| |
| |-- /visualizations
| | |-- InfluenceNetwork.vue  # 关系网络图组件
| | |-- GenreStreamgraph.vue# 流派演化流图组件
| | |-- InfluenceSankey.vue # 影响力流桑基图组件
| | |-- CareerTrajectory.vue# 艺术家生涯轨迹分析器组件
|
|-- /services
| |-- dataService.js        # 负责加载和预处理数据的模块
|
|-- /stores
| |-- graphStore.js         # Pinia store，用于管理应用状态
|
|-- App.vue                   # 应用的根组件，负责整体布局
|
|-- main.js                   # Vue 应用的入口文件
```

具体视图在components里。services和stores里的文件是公用函数和数据，修改的时候应特别注意，尽量不要改变已有的函数或者数据，以免其他人的代码出bug。如果需要函数或数据可以单独创立。

# 3. Git规范
为保证多人协作代码的高效性以及代码安全性，最好使用git在GitHub与本地之间搭建桥梁。本地修改代码后push到GitHub上，注意每次修改应有说明指示修改之处。

## 3.1 安装Git
[Git官方网站](https://git-scm.com/downloads)

下载完成后基本一路Next即可。

用`git --version`检查是否安装成功。

## 3.2 使用Git从仓库clone到本地
首先确保vscode已经安装好相关插件`GitHub Pull Requests`，并且已经登录自己的Github账号

- 在vscode中按下快捷键 Ctrl+Shift+P (在 Mac 上是 Cmd+Shift+P)，在弹出的命令输入框中输入：`Git: Clone`
- 选中后选择`Clone from GitHub`
- 然后选择本仓库即可

还需要进行仓库的设置和初始化，即告诉Git你是谁，以防不知道是谁提交了代码(在终端中配置)：
- `git config --global user.name "Your Name"`
- `git config --global user.email "youremail@example.com"`

## 3.3 常用Git指令

### 3.3.1 本地工作流
| 指令                      | 作用       | 说明                                                |
| :---------------------: | :------: | :-----------------------------------------------: |
| git status              | 查看仓库状态   | 最常用的命令。显示哪些文件被修改、暂存或未被跟踪。                         |
| git add \[file\]        | 添加文件到暂存区 | 告诉 Git，你希望将这个文件的当前改动包含在下一次提交中。git add . 可以暂存所有改动。 |
| git commit -m "Message" | 提交暂存的更改  | 将暂存区的所有内容创建一个新的“快照”（版本”，并附上一条描述信息。这是 Git 的核心保存动作。 |
| git diff                | 查看文件差异   | 显示工作区文件与暂存区或上一次提交之间的具体代码差异。                       |

### 3.3.2  与远程仓库交互
| 指令            | 作用        | 说明                                        |
| :-----------: | :-------: | :---------------------------------------: |
| git push      | 推送本地提交    | 将本地分支的提交上传到与之关联的远程分支。                     |
| git pull      | 拉取并合并远程更改 | 从远程分支下载最新代码，并自动与你的本地分支进行合并 (merge)。       |
| git fetch     | 拉取远程更改    | 只从远程下载最新的代码历史，但不会自动合并。它让你先查看远程的变动再决定如何合并。 |
| git remote -v | 查看远程仓库信息  | 显示当前项目连接的所有远程仓库的名称和地址。                    |

### 3.3.3 分支与合并（我们这次就不用这个功能了，直接在main下面修改吧）

| 指令            | 作用        | 说明                                        |
| :-----------: | :-------: | :---------------------------------------: |
|git branch	    |查看、创建、删除分支	|git branch 列出所有本地分支；git branch [name] 创建新分支；git branch -d [name] 删除分支。|
|git checkout [branch-name]	|切换分支	|切换到指定的分支进行工作。|
|git checkout -b [branch-name]	|创建并切换到新分支	|这是 git branch [name]和git checkout [name]两条命令的快捷方式。|
|git merge [branch-name]	|合并分支	|将指定分支的更改合并到你当前所在的分支。|

### 3.3.4 查看历史与撤销
| 指令            | 作用        | 说明                                        |
| :-----------: | :-------: | :---------------------------------------: |
|git log	|查看提交历史	|显示从近到远的提交日志，包括提交哈希值、作者、日期和提交信息。
|git reset [commit-hash]	|重置到某次提交	|将 HEAD 指针和当前分支重置到指定的提交，有 --soft, --mixed, --hard 三种模式，--hard 会丢弃工作区代码，需谨慎使用。
|git revert [commit-hash]	|撤销某次提交	|创建一个新的提交，其内容与指定的旧提交完全相反。这是一种安全的“撤销”方式，因为它不修改历史。

## 3.4 Git开发规范
### 3.4.1 提交信息规范
这是最重要的规范。一个好的 Commit Message 能让人快速理解这次提交的目的。

格式: 采用 类型(范围): 简短描述 的格式。

类型 (Type):
- feat: 新功能 (feature)
- fix: 修复 Bug
- docs: 只修改了文档 (documentation)
- style: 代码格式修改，不影响代码逻辑 (空格、格式化等)
- refactor: 代码重构，既没加新功能也没修 Bug
- test: 增加或修改测试
- chore: 构建过程或辅助工具的变动
- 范围 (Scope): 可选，说明本次提交影响的范围，如 login, user-profile 等。
- 描述 (Description): 动词开头，使用祈使句（如 Add 而不是 Added），简明扼要。

示例:

- feat(login): add user password validation
- fix(api): correct calculation error for order total
- docs: update installation guide

### 3.4.2 提交频率与粒度
- 原子提交：坚持“一次提交只做一件事”的原则。例如，修复一个 Bug 和增加一个新功能应该是两次独立的提交。这使得代码历史清晰，也更容易在出问题时回滚。
- 频繁提交: 不要把几天的代码堆在一起做一次巨大的提交。建议完成一个小的、完整的功能点就进行一次提交。

### 3.4.3 保持同步
每次开始新任务之前记得先`git pull`仓库的最新代码，结束后也记得`git push`提交。

## 3.5 大致流程
- 先`git pull`更新最新仓库
- 本地编写代码
- 查看状态：写完一部分代码后，你很好奇 Git 是如何看待这些改动的。`git status`
- **暂存变更**，提交之前需要保存更改。```# 使用 . 来暂存所有改动（包括新增和修改的）
git add .```
- **提交变更**,```git commit -m "feat: add about page and navigation link"```
- 上传到仓库：`git push`

# 4. 常见问题
网络问题，git pull或者push失败。

- 原因：浏览器通常能自动使用 VPN 建立的网络通道，但命令行终端（比如你在 VS Code 里用的）默认情况下可能不会，导致 git 命令依然尝试通过你本地的有问题的、不走 VPN 的网络去连接 GitHub，所以依然会失败。
- 解决：为 Git 设置本地代理 
- - 找到VPN软件提供的端口。这通常是一个数字，常见的有 7890 (Clash 默认), 10809, 1080, 8889 等。
- - 在终端中执行命令：```git config --global http.proxy http://127.0.0.1:port_number
git config --global https.proxy http://127.0.0.1:port_number```



  

