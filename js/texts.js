const TextContent = (() => {
  const classicTexts = {
    easy: [
      "The only way to do great work is to love what you do.",
      "Life is what happens when you are busy making other plans.",
      "The best time to plant a tree was twenty years ago. The second best time is now.",
      "It does not matter how slowly you go as long as you do not stop.",
      "In the end we only regret the chances we did not take.",
      "The purpose of our lives is to be happy and to help others.",
      "You miss every shot you do not take in life.",
      "Be the change that you wish to see in the world today.",
      "The journey of a thousand miles begins with a single step forward.",
      "Do what you can with what you have where you are right now.",
      "Every moment is a fresh beginning for those who dare.",
      "The best way to predict the future is to create it yourself.",
      "What we think we become. What we feel we attract.",
      "The mind is everything. What you think you become in time.",
      "Believe you can and you are already halfway there my friend."
    ],
    medium: [
      "In the middle of difficulty lies opportunity. The important thing is not to stop questioning. Curiosity has its own reason for existing.",
      "Success is not final and failure is not fatal. It is the courage to continue that counts in the grand scheme of things.",
      "The greatest glory in living lies not in never falling, but in rising every time we fall. That is the mark of true strength.",
      "You have power over your mind, not outside events. Realize this and you will find great strength within yourself.",
      "The only impossible journey is the one you never begin. Take that first step and the path will reveal itself to you.",
      "It is during our darkest moments that we must focus to see the light. The light is always there waiting to be found.",
      "Tell me and I forget. Teach me and I remember. Involve me and I learn. That is the true nature of education and growth.",
      "Many of life's failures are people who did not realize how close they were to success when they gave up trying.",
      "The future belongs to those who believe in the beauty of their dreams and have the courage to pursue them relentlessly.",
      "Education is the most powerful weapon which you can use to change the world and shape a better tomorrow for everyone.",
      "I have not failed. I have just found ten thousand ways that do not work. Each attempt brings me closer to the answer.",
      "Happiness is not something ready made. It comes from your own actions and the choices you make every single day.",
      "The only limit to our realization of tomorrow will be our doubts of today. Let us move forward with strong and active faith.",
      "Life is really simple but we insist on making it complicated. Simplicity is the ultimate sophistication in all things.",
      "The secret of getting ahead is getting started. The secret of getting started is breaking complex tasks into small manageable ones."
    ],
    hard: [
      "It is not the critic who counts; not the man who points out how the strong man stumbles, or where the doer of deeds could have done them better. The credit belongs to the man who is actually in the arena, whose face is marred by dust and sweat and blood.",
      "We hold these truths to be self-evident, that all men are created equal, that they are endowed by their Creator with certain unalienable Rights, that among these are Life, Liberty and the pursuit of Happiness.",
      "In a hole in the ground there lived a hobbit. Not a nasty, dirty, wet hole, filled with the ends of worms and an oozy smell, nor yet a dry, bare, sandy hole with nothing in it to sit down on or to eat: it was a hobbit-hole, and that means comfort.",
      "The only thing we have to fear is fear itself; nameless, unreasoning, unjustified terror which paralyzes needed efforts to convert retreat into advance. In every dark hour of our national life a leadership of frankness and vigor has met with understanding.",
      "Two roads diverged in a wood, and I took the one less traveled by, and that has made all the difference. I shall be telling this with a sigh somewhere ages and ages hence, when I look back on the choices I have made.",
      "It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of Light, it was the season of Darkness.",
      "To be, or not to be, that is the question: Whether it is nobler in the mind to suffer the slings and arrows of outrageous fortune, or to take arms against a sea of troubles, and by opposing end them.",
      "The world is a book, and those who do not travel read only one page. Every journey teaches us something new about ourselves; every destination reveals a truth we could not have discovered by staying home.",
      "Shall I compare thee to a summer's day? Thou art more lovely and more temperate: Rough winds do shake the darling buds of May, and summer's lease hath all too short a date.",
      "All that is gold does not glitter, not all those who wander are lost; the old that is strong does not wither, deep roots are not reached by the frost. From the ashes a fire shall be woken, a light from the shadows shall spring."
    ]
  };

  const codeSnippets = {
    javascript: [
      `function fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}`,
      `const fetchData = async (url) => {\n  const response = await fetch(url);\n  const data = await response.json();\n  return data;\n};`,
      `const debounce = (fn, delay) => {\n  let timer;\n  return (...args) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), delay);\n  };\n};`,
      `class EventEmitter {\n  constructor() {\n    this.events = {};\n  }\n  on(event, callback) {\n    if (!this.events[event]) {\n      this.events[event] = [];\n    }\n    this.events[event].push(callback);\n  }\n  emit(event, ...args) {\n    const handlers = this.events[event];\n    if (handlers) {\n      handlers.forEach(fn => fn(...args));\n    }\n  }\n}`,
      `const flattenArray = (arr) => {\n  return arr.reduce((flat, item) => {\n    return flat.concat(\n      Array.isArray(item) ? flattenArray(item) : item\n    );\n  }, []);\n};`,
      `document.addEventListener("DOMContentLoaded", () => {\n  const buttons = document.querySelectorAll(".btn");\n  buttons.forEach(btn => {\n    btn.addEventListener("click", (e) => {\n      e.target.classList.toggle("active");\n    });\n  });\n});`,
      `function deepClone(obj) {\n  if (obj === null || typeof obj !== "object") {\n    return obj;\n  }\n  const clone = Array.isArray(obj) ? [] : {};\n  for (const key in obj) {\n    clone[key] = deepClone(obj[key]);\n  }\n  return clone;\n}`
    ],
    python: [
      `def binary_search(arr, target):\n    low, high = 0, len(arr) - 1\n    while low <= high:\n        mid = (low + high) // 2\n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            low = mid + 1\n        else:\n            high = mid - 1\n    return -1`,
      `def quicksort(arr):\n    if len(arr) <= 1:\n        return arr\n    pivot = arr[len(arr) // 2]\n    left = [x for x in arr if x < pivot]\n    middle = [x for x in arr if x == pivot]\n    right = [x for x in arr if x > pivot]\n    return quicksort(left) + middle + quicksort(right)`,
      `class Stack:\n    def __init__(self):\n        self.items = []\n\n    def push(self, item):\n        self.items.append(item)\n\n    def pop(self):\n        if not self.is_empty():\n            return self.items.pop()\n        return None\n\n    def is_empty(self):\n        return len(self.items) == 0`,
      `def flatten(lst):\n    result = []\n    for item in lst:\n        if isinstance(item, list):\n            result.extend(flatten(item))\n        else:\n            result.append(item)\n    return result`,
      `with open("data.txt", "r") as file:\n    lines = file.readlines()\n    for line in lines:\n        words = line.strip().split()\n        if len(words) > 0:\n            print(f"Line: {words[0]}")`,
      `def memoize(func):\n    cache = {}\n    def wrapper(*args):\n        if args not in cache:\n            cache[args] = func(*args)\n        return cache[args]\n    return wrapper`
    ],
    html: [
      `<nav class="navbar">\n  <div class="logo">\n    <a href="/">TypeRush</a>\n  </div>\n  <ul class="nav-links">\n    <li><a href="/about">About</a></li>\n    <li><a href="/contact">Contact</a></li>\n  </ul>\n</nav>`,
      `<form class="login-form" action="/login" method="POST">\n  <div class="form-group">\n    <label for="email">Email</label>\n    <input type="email" id="email" name="email" required>\n  </div>\n  <div class="form-group">\n    <label for="password">Password</label>\n    <input type="password" id="password" name="password" required>\n  </div>\n  <button type="submit" class="btn">Log In</button>\n</form>`,
      `<section class="hero">\n  <div class="container">\n    <h1 class="hero-title">Welcome to TypeRush</h1>\n    <p class="hero-subtitle">Test your typing speed</p>\n    <div class="hero-actions">\n      <a href="#play" class="btn btn-primary">Play Now</a>\n      <a href="#learn" class="btn btn-secondary">Learn More</a>\n    </div>\n  </div>\n</section>`,
      `<div class="card-grid">\n  <article class="card">\n    <img src="image.jpg" alt="Card image">\n    <div class="card-body">\n      <h3 class="card-title">Title Here</h3>\n      <p class="card-text">Description goes here.</p>\n      <a href="#" class="card-link">Read More</a>\n    </div>\n  </article>\n</div>`,
      `<table class="data-table">\n  <thead>\n    <tr>\n      <th>Name</th>\n      <th>Email</th>\n      <th>Role</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr>\n      <td>Alice</td>\n      <td>alice@example.com</td>\n      <td>Admin</td>\n    </tr>\n  </tbody>\n</table>`
    ],
    css: [
      `.card {\n  display: flex;\n  flex-direction: column;\n  padding: 1.5rem;\n  border-radius: 12px;\n  background: var(--card-bg);\n  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);\n  transition: transform 0.2s ease;\n}`,
      `@keyframes fadeIn {\n  from {\n    opacity: 0;\n    transform: translateY(20px);\n  }\n  to {\n    opacity: 1;\n    transform: translateY(0);\n  }\n}\n\n.animate-in {\n  animation: fadeIn 0.4s ease forwards;\n}`,
      `.grid-layout {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));\n  gap: 1.5rem;\n  padding: 2rem;\n  max-width: 1200px;\n  margin: 0 auto;\n}`,
      `:root {\n  --primary: #3b82f6;\n  --secondary: #8b5cf6;\n  --bg: #0f172a;\n  --text: #e2e8f0;\n  --border: #334155;\n}\n\n* {\n  margin: 0;\n  padding: 0;\n  box-sizing: border-box;\n}\n\nbody {\n  font-family: system-ui, sans-serif;\n  background: var(--bg);\n  color: var(--text);\n}`,
      `.btn {\n  display: inline-flex;\n  align-items: center;\n  gap: 0.5rem;\n  padding: 0.75rem 1.5rem;\n  border: none;\n  border-radius: 8px;\n  font-size: 1rem;\n  font-weight: 600;\n  cursor: pointer;\n  transition: all 0.2s ease;\n}\n\n.btn:hover {\n  transform: translateY(-2px);\n  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);\n}`
    ],
    rust: [
      `fn main() {\n    let numbers = vec![1, 2, 3, 4, 5];\n    let sum: i32 = numbers.iter().sum();\n    println!("Sum: {}", sum);\n}`,
      `fn fibonacci(n: u32) -> u32 {\n    match n {\n        0 => 0,\n        1 => 1,\n        _ => fibonacci(n - 1) + fibonacci(n - 2),\n    }\n}`,
      `struct Point {\n    x: f64,\n    y: f64,\n}\n\nimpl Point {\n    fn new(x: f64, y: f64) -> Self {\n        Point { x, y }\n    }\n\n    fn distance(&self, other: &Point) -> f64 {\n        let dx = self.x - other.x;\n        let dy = self.y - other.y;\n        (dx * dx + dy * dy).sqrt()\n    }\n}`,
      `fn bubble_sort(arr: &mut Vec<i32>) {\n    let n = arr.len();\n    for i in 0..n {\n        for j in 0..n - 1 - i {\n            if arr[j] > arr[j + 1] {\n                arr.swap(j, j + 1);\n            }\n        }\n    }\n}`,
      `use std::collections::HashMap;\n\nfn word_count(text: &str) -> HashMap<&str, usize> {\n    let mut map = HashMap::new();\n    for word in text.split_whitespace() {\n        let count = map.entry(word).or_insert(0);\n        *count += 1;\n    }\n    map\n}`,
      `enum Shape {\n    Circle(f64),\n    Rectangle(f64, f64),\n    Triangle(f64, f64),\n}\n\nimpl Shape {\n    fn area(&self) -> f64 {\n        match self {\n            Shape::Circle(r) => std::f64::consts::PI * r * r,\n            Shape::Rectangle(w, h) => w * h,\n            Shape::Triangle(b, h) => 0.5 * b * h,\n        }\n    }\n}`
    ]
  };

  const wordList = [
    "the","be","to","of","and","a","in","that","have","it","for","not","on","with","he",
    "as","you","do","at","this","but","his","by","from","they","we","say","her","she","or",
    "an","will","my","one","all","would","there","their","what","so","up","out","if","about",
    "who","get","which","go","me","when","make","can","like","time","no","just","him","know",
    "take","people","into","year","your","good","some","could","them","see","other","than",
    "then","now","look","only","come","its","over","think","also","back","after","use","two",
    "how","our","work","first","well","way","even","new","want","because","any","these","give",
    "day","most","us","great","between","need","large","often","hand","high","place","hold",
    "here","thing","man","world","life","still","went","should","call","keep","school","never",
    "last","let","thought","city","tree","cross","farm","hard","start","might","story","far",
    "sea","late","run","left","while","press","close","night","real","open","seem","together",
    "next","white","children","begin","got","walk","example","ease","paper","group","always",
    "music","those","both","mark","book","letter","until","mile","river","car","feet","care",
    "second","enough","plain","girl","usual","young","ready","above","ever","red","list","though",
    "feel","talk","bird","soon","body","dog","family","direct","pose","leave","song","measure",
    "door","product","black","short","number","class","wind","question","happen","complete",
    "ship","area","half","rock","order","fire","south","problem","piece","told","knew","pass",
    "since","top","whole","king","space","heard","best","hour","better","true","during","hundred",
    "five","remember","step","early","hold","west","ground","interest","reach","fast","verb",
    "sing","listen","six","table","travel","less","morning","ten","simple","several","vowel",
    "toward","war","lay","against","pattern","slow","center","love","person","money","serve",
    "appear","road","map","rain","rule","govern","pull","cold","notice","voice","unit","power",
    "town","fine","certain","fly","fall","lead","cry","dark","machine","note","wait","plan",
    "figure","star","box","noun","field","rest","correct","able","pound","done","beauty","drive",
    "stood","contain","front","teach","week","final","gave","green","quick","develop","ocean",
    "warm","free","minute","strong","special","mind","behind","clear","tail","produce","fact",
    "street","inch","multiply","nothing","course","stay","wheel","full","force","blue","object",
    "decide","surface","deep","moon","island","foot","system","busy","test","record","boat",
    "common","gold","possible","plane","stead","dry","wonder","laugh","thousand","ago","ran",
    "check","game","shape","equate","hot","miss","brought","heat","snow","tire","bring","yes",
    "distant","fill","east","paint","language","among","grand","ball","yet","wave","drop","heart",
    "am","present","heavy","dance","engine","position","arm","wide","sail","material","size",
    "vary","settle","speak","weight","general","ice","matter","circle","pair","include","divide",
    "syllable","felt","perhaps","pick","sudden","count","reason","square","exact","bone","age",
    "done","string","gas","corn","print","dead","spot","desert","suit","current","lift","rose",
    "continue","block","chart","hat","sell","success","company","subtract","event","particular",
    "deal","swim","term","opposite","wife","shoe","shoulder","spread","arrange","camp","invent",
    "cotton","born","determine","quart","nine","truck","noise","level","chance","gather","shop",
    "stretch","throw","shine","property","column","molecule","select","wrong","gray","repeat",
    "require","broad","prepare","salt","nose","plural","anger","claim","continent","type","draw",
    "score","tiny","cool","practice","coast","key","method","sign","wild","solve","capital"
  ];

  function getClassicText(difficulty) {
    const texts = classicTexts[difficulty] || classicTexts.medium;
    return texts[Math.floor(Math.random() * texts.length)];
  }

  function getCodeSnippet(language) {
    const snippets = codeSnippets[language] || codeSnippets.javascript;
    return snippets[Math.floor(Math.random() * snippets.length)];
  }

  function generateWords(count) {
    const words = [];
    for (let i = 0; i < count; i++) {
      words.push(wordList[Math.floor(Math.random() * wordList.length)]);
    }
    return words.join(" ");
  }

  return { getClassicText, getCodeSnippet, generateWords };
})();
