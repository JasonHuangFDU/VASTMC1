# 1. MC1_graph.json
原始文件

# 2. graph_processed.json
在MC1_graph.json基础上进行的数据处理，处理脚本为`data_process.ipynb`

新增信息如下：
- 对人、乐队、音乐公司节点计算其影响力分数，计算方式为：$$score_i = 2\times \text{number of notable work} + d_i$$
- 对Person 或 MusicalGroup 节点，根据其相关作品计算得出其主导流派。
- 添加了Person 或 MusicalGroup 节点的notable_work_num,如果$\text{notable\_work\_num} > 5$，则标记该节点的`notable = True`