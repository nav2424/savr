# SAGE AI Assistant Setup

SAGE is powered by OpenAI's GPT-4 to provide intelligent, context-aware responses to all your kitchen and cooking questions.

## 🔑 Setting Up Your OpenAI API Key

### Step 1: Get Your API Key

1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-...`)

### Step 2: Add Your API Key

**Option A: Environment Variable (Recommended)**

Create a `.env` file in the project root:

```bash
EXPO_PUBLIC_OPENAI_API_KEY=sk-your-actual-key-here
```

**Option B: Direct Configuration**

Edit `config.ts` and replace `YOUR_API_KEY_HERE`:

```typescript
export const config = {
  openaiApiKey: 'sk-your-actual-key-here',
  // ...
}
```

### Step 3: Restart Expo

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npx expo start --clear
```

## 🌿 SAGE Capabilities

Once configured, SAGE can:

### Pantry Management
```
"I ate a banana"
"Add 2 lbs of chicken to my fridge"
"Add milk to my pantry"
"I used 3 eggs"
```

### List Management
```
"Add cream cheese to weekly groceries"
"Add 3 avocados to dinner party"
"Put milk on my shopping list"
```

### Cooking Questions
```
"How do I cook pasta?"
"What can I make with chicken and rice?"
"How long do I cook salmon?"
"Give me a recipe for chicken stir fry"
```

### General Questions
```
"What's the difference between baking powder and baking soda?"
"How do I store fresh herbs?"
"What temperature should I cook chicken to?"
```

## 💡 Tips

- SAGE understands natural language - just ask normally!
- Conversation history is maintained for context
- Commands are parsed and executed automatically
- Fallback to pattern matching if OpenAI is unavailable

## 🔒 Security

- Never commit your `.env` file to git
- The `.gitignore` already excludes `.env`
- Keep your API key private
- Monitor your OpenAI usage at [platform.openai.com](https://platform.openai.com/usage)

## 💰 Pricing

OpenAI charges per token:
- GPT-4: ~$0.03 per 1K tokens
- Average conversation: ~$0.01-0.05
- Set usage limits in your OpenAI dashboard

## 🚀 Ready!

Once your API key is configured, tap the **S** button in the bottom right of any tab to start chatting with SAGE!


