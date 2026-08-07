const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'test-vault', 'memos');

if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

const generateRandomTime = (daysBack) => {
    const d = new Date();
    d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
    d.setHours(Math.floor(Math.random() * 24));
    d.setMinutes(Math.floor(Math.random() * 60));
    const pad = (n) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const mocks = [
    "这是一个关于 #Obsidian 的测试笔记，展示如何进行快速记录。",
    "今天的心情很不错，准备把项目重构一下！",
    "刚学习了一些新知识：#TypeScript 中的泛型非常有用。\\n可以在函数声明时约束参数类型。",
    "别忘了这周末去采购。#生活",
    "随机记录的一个想法，也许以后能用上。"
];

mocks.forEach((content, i) => {
    const time = generateRandomTime(5);
    const filename = `mock-memo-${i + 1}.md`;
    const frontmatter = `---
created: ${time}
pinned: ${i === 0 ? 'true' : 'false'}
---
`;
    fs.writeFileSync(path.join(targetDir, filename), frontmatter + content);
});

console.log(`Generated ${mocks.length} mock memos in test-vault/memos.`);
