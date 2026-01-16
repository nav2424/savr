# 🧪 Test SAGE Intelligence - Quick Reference

## How to Test

1. **Open the app**
2. **Tap the SAGE button** (floating "S" button bottom-right)
3. **Try these test queries** to see the intelligence in action

---

## Test Queries

### ✅ Test 1: Context Extraction (The Main Fix)
**Say:** "Create a 500 calorie snack using an item from my pantry"

**Expected:**
- SAGE immediately presents 3 snack options
- No question asking "Want to use pantry items?"
- All options are ~500 calories from pantry items

**Why it works:** SAGE extracts `{calories: 500, mealType: "snack", usePantry: true}` and proceeds directly.

---

### ✅ Test 2: Smart Defaults
**Say:** "Make a high protein breakfast"

**Expected:**
- SAGE may ask ONE question: "Want to use items from your pantry?"
- OR immediately presents 3 high-protein breakfast options
- No redundant questions

**Why it works:** SAGE extracts `{protein: "high", mealType: "breakfast"}` and defaults calories/other parameters.

---

### ✅ Test 3: Full Context Extraction
**Say:** "Quick Italian dinner for 4 people"

**Expected:**
- SAGE immediately presents 3 Italian dinner options
- All recipes serve 4
- All recipes are 30-40 minutes max
- No questions

**Why it works:** SAGE extracts `{cuisine: "Italian", mealType: "dinner", servings: 4, time: "quick"}`.

---

### ✅ Test 4: Cooking Question
**Say:** "How do I make pasta less sticky?"

**Expected:**
- Direct, expert answer with actionable steps
- No deflection to recipe tab
- Concise and helpful

**Example answer:** "Add a tablespoon of olive oil to the cooking water and stir occasionally..."

---

### ✅ Test 5: Substitution
**Say:** "What can I substitute for eggs in baking?"

**Expected:**
- Multiple substitution options
- Ratios provided (e.g., "1 egg = 1/4 cup applesauce")
- Different options for different use cases

---

### ✅ Test 6: Pantry Command
**Say:** "I ate 2 bananas"

**Expected:**
- Command executed: `[PANTRY_REMOVE:2:bananas]`
- Confirmation: "Got it! Removed 2 bananas from your pantry. 🍌"

---

### ✅ Test 7: Grocery List
**Say:** "Add milk to my grocery list"

**Expected:**
- Command executed: `[LIST_ADD:1:milk:weekly groceries]`
- Confirmation: "Added milk to your grocery list! ✓"

---

### ✅ Test 8: Nutrition Question
**Say:** "Is quinoa high in protein?"

**Expected:**
- Direct answer with context
- Nutritional details
- Comparison if relevant

---

### ✅ Test 9: Storage Tip
**Say:** "How to keep avocados fresh?"

**Expected:**
- Practical storage tips
- Multiple methods if applicable
- Clear, actionable advice

---

### ✅ Test 10: Conversion
**Say:** "How many cups in a liter?"

**Expected:**
- Direct conversion with precision
- Context if helpful (e.g., "approximately 4.2 cups")

---

## What to Look For

### ✅ Good Signs:
- **No redundant questions** - SAGE doesn't ask for info you already provided
- **Context awareness** - SAGE understands your intent immediately
- **Direct answers** - Gets to the point quickly
- **Natural conversation** - Feels like talking to an expert
- **Smart defaults** - Fills in missing info intelligently

### ❌ Red Flags:
- Asking for info already provided (e.g., "Want to use pantry?" when you said "using my pantry")
- Multiple unnecessary questions before giving answer
- Generic, unhelpful responses
- Not understanding the query type
- Deflecting to other tabs instead of answering

---

## Edge Cases to Test

### Test: Ambiguous Query
**Say:** "What should I make for dinner?"

**Expected:**
- SAGE asks clarifying question with quick options
- Example: "What ingredients do you have on hand, or should I suggest some classics? [Use my pantry | Suggest classics]"

---

### Test: Multi-parameter Query
**Say:** "Low carb vegan lunch under 400 calories"

**Expected:**
- SAGE extracts: `{carbs: "low", dietary: "vegan", mealType: "lunch", calories: 400}`
- Presents 3 options matching ALL criteria
- No unnecessary questions

---

### Test: Technique Question
**Say:** "How to properly dice an onion?"

**Expected:**
- Step-by-step technique instructions
- Clear, visual descriptions
- Safety tips if relevant

---

### Test: Complex Substitution
**Say:** "Can I replace butter with olive oil in cookies?"

**Expected:**
- Yes/no answer
- Ratio (e.g., "Use 3/4 cup oil for 1 cup butter")
- Impact on texture/flavor
- Tips for best results

---

## Performance Benchmarks

### Response Time:
- Simple commands (pantry/list): < 1 second
- Cooking questions: 2-3 seconds
- Recipe generation: 3-5 seconds
- Complex queries: 3-4 seconds

### Accuracy:
- Context extraction: Should be 95%+ accurate
- Answer relevance: 100% (no deflections)
- Recipe quality: High (matches all specified criteria)

---

## Troubleshooting

### If SAGE asks redundant questions:
1. Check that you're using the latest version
2. Try rephrasing with clearer intent
3. Report the query - this shouldn't happen

### If SAGE doesn't understand:
1. Try being more specific
2. Use natural language (don't try to use commands)
3. Provide context in one message

### If responses are slow:
1. Check internet connection
2. Verify OpenAI API key is configured
3. Try shorter, simpler queries first

---

## Quick Test Script

**Run these 5 queries in order to verify all improvements:**

1. "Create a 500 calorie snack using an item from my pantry"
2. "How do I make pasta less sticky?"
3. "What can I substitute for eggs?"
4. "I ate 2 bananas"
5. "Quick Italian dinner for 4"

**All 5 should work perfectly with:**
- No redundant questions
- Direct, helpful answers
- Fast response times
- Natural conversation

---

## Success Criteria

✅ **SAGE passes if:**
- Understands context from initial message
- Doesn't ask for info already provided
- Handles any query type intelligently
- Provides direct, expert answers
- Feels natural and conversational

❌ **SAGE fails if:**
- Asks redundant questions
- Doesn't extract parameters from message
- Can't handle query types outside recipes
- Gives generic, unhelpful responses
- Feels rigid or scripted

---

## Report Findings

If you find issues or edge cases:
1. Note the exact query you used
2. Note SAGE's response
3. Note what the expected response should be
4. We'll continue improving!

---

## The Goal

SAGE should feel like **the smartest kitchen AI assistant** you've ever used. Natural, adaptive, intelligent, and helpful. Every interaction should be delightful, not frustrating. 🧠✨

