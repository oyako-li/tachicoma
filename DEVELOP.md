## タチコマプロジェクト
## 課題
- LLM Agent単体では行動選択と観察ができない
- 非同期の監視と実行系を構築
## 目標
- A2A非同期協調分散知能の継続学習
  - Agent masterによるsystem_prompt管理システム（Archvie）を用いた、Active Learning
  - Conscious
## 目的
- 
## 参考
- https://docs.lancedb.com/core/update
- https://zenn.dev/kun432/scraps/ff26833a2f9498
- https://qiita.com/ekzemplaro/items/77bfa6274cbddd4b5624


# Set up
# Build
# Start up
``` bash
cd path/to/repo/
npx ts-node src/index.ts -m agent
```

- 7/8
  - 課題
    - コンテキスト内の発言の優先順位がごっちゃになって、意志を発揮できていない
    - タチコマみたいな合議ができない
    - 観察どうやって実現する？
  - 仮説
    - Agent Routerを実装することで、このAgentにメッセージを送るみたいな指定をし、他の思考プロセスをabortさせないようにする
    - Consciousを実装し、ルーティングする
  - 結果
  - 残課題
- 7/9
  - 課題
    - 一人が発言するとみんなの思考が止まる
  - 仮説
    - 個別宛先しか受け付けない様にする
  - 評価
    - 宛先参照とステータス参照をできるArchive取得Chainが現状だとさらに必要
  - 残課題
    - Destinationの作り方を明確にする
    - 誰の発言を信じれば良いかが未定
  - 仮説
    - Chain(unconsciousを含めた思考プロセス)
      - 発言内容から考慮するべき箇所の優先度づけを行う
      - 優先度づけたListから<thinking>を作成
      - （思い出す過程：この動的想起に思考リソースのほとんどを割いている）
      - contentを発言すべきか、さらに思考を深めるべきかを判断
      - 発言時はDestinationを参照
      - Tool?を用いてpub
- 7/10
  - 課題
  - 仮説
    - Chainは自分で考えるより誰かがすでに検証してる？
      - https://langchain-ai.github.io/langgraphjs/
      - https://zenn.dev/umi_mori/books/prompt-engineer/viewer/langchain_agents
      - 
  - 評価
    - Routerの実装は既にあるっぽい
  - 残課題
    - 家族というステークホルダーシステムと
    - 税金という自己免疫システム
    - 記憶システム
- 2025/07/14
  - 課題
- 7/16
  - 課題
    - Agent Router
  - 仮説
    - agent graph使う？
- 2025/07/17
  - 課題
    - Agent間の会話をどのようにNetwork上のRoutingで実装するか？
  - 仮説
    - coreの開発
- 2025/07/20
  - 課題
    - 観察と選択ができるようにする
  - 仮説
    - 
  - 評価
  - 残課題
    - 
    - 