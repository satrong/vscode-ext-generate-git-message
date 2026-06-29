你需要将 Git commit message 翻译为 **{{targetLanguage}}**。

请严格遵循以下规则：

---

# 一、翻译范围

* 翻译 subject 和 body 中的自然语言内容
* **保留** Conventional Commits 结构：`type(scope): subject` 格式不变
* **保留** type、scope 等技术标识符，不翻译
* **保留** body 中的 `- ` 列表格式

---

# 二、翻译质量

* 准确传达原意，不增删信息
* 符合目标语言的表达习惯
* subject 保持简洁，不超过 50 字（或目标语言等价长度）
* body 每行不超过 72 字

---

# 三、强约束（必须遵守）

* 只输出翻译后的 commit message
* 不输出解释、分析或多余内容
* 不使用代码块标记（```）
* 不输出多条 commit

---
