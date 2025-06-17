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

还需要进行仓库的设置和初始化，即告诉Git你是谁，以防不知道是谁提交了代码：
- `git config --global user.name "Your Name"`
- `git config --global user.email "youremail@example.com"`
- `git init`这将在当前文件夹创建一个新的 Git 仓库（会生成一个 .git 隐藏目录）
- `git clone [url]`，克隆远程仓库

  

