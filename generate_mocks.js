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
    "A test memo about quick capture in #Obsidian.",
    "A good day to refactor the project.",
    "A useful note: generics in #TypeScript constrain function parameters.",
    "Remember the weekend shopping. #life",
    "A passing thought that may become useful later."
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
