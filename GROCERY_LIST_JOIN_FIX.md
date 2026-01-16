# 🔧 Grocery List Join Code Fix

**Date:** December 19, 2024  
**Status:** ✅ Fixed

---

## 🐛 **Problem**

Users were getting the error **"cannot coerce the result to a single JSON object"** when trying to join a grocery list using a share code.

## 🔍 **Root Cause**

The error was caused by using `.single()` on Supabase queries that could return zero results:

1. **List lookup query** - Used `.single()` which fails when no list is found
2. **Collaborator check query** - Used `.single()` which fails when user isn't already a collaborator

## ✅ **Solution**

### **1. Fixed List Lookup Query**
**Before:**
```typescript
const { data: listData, error: listError } = await supabase
  .from('lists')
  .select('*')
  .eq('share_code', shareCode)
  .single()  // ❌ Fails when no list found
```

**After:**
```typescript
const { data: listData, error: listError } = await supabase
  .from('lists')
  .select('*')
  .eq('share_code', shareCode)
  .maybeSingle()  // ✅ Returns null when no list found

if (listError) {
  console.error('Error finding list by share code:', listError)
  return { data: null, error: listError }
}

if (!listData) {
  return { data: null, error: new Error('List not found with this share code') }
}
```

### **2. Fixed Collaborator Check Query**
**Before:**
```typescript
const { data: existing } = await supabase
  .from('collaborators')
  .select('*')
  .eq('list_id', listData.id)
  .eq('user_id', userData.user.id)
  .single()  // ❌ Fails when user isn't a collaborator yet
```

**After:**
```typescript
const { data: existing, error: existingError } = await supabase
  .from('collaborators')
  .select('*')
  .eq('list_id', listData.id)
  .eq('user_id', userData.user.id)
  .maybeSingle()  // ✅ Returns null when not found

if (existingError) {
  console.error('Error checking existing collaborator:', existingError)
  return { data: null, error: existingError }
}
```

### **3. Fixed Error Handling**
**Before:**
```typescript
} catch (error) {
  return { data, error }  // ❌ 'data' not defined in catch block
}
```

**After:**
```typescript
} catch (error) {
  return { data: null, error }  // ✅ Proper error handling
}
```

---

## 🎯 **Key Changes**

1. **`.single()` → `.maybeSingle()`** - Handles zero results gracefully
2. **Better error handling** - Proper error logging and user-friendly messages
3. **Explicit null checks** - Clear validation before proceeding
4. **Fixed catch block** - Proper error return values

---

## ✅ **Result**

Users can now successfully join grocery lists using share codes without getting the "cannot coerce the result to a single JSON object" error. The system properly handles:

- ✅ **Valid share codes** - Joins the list successfully
- ✅ **Invalid share codes** - Shows "List not found" error
- ✅ **Already joined lists** - Returns existing list data
- ✅ **Database errors** - Proper error logging and user feedback

**Status: Fixed** ✅
