# MCP (Model Context Protocol) Setup

This project is configured with standard MCP servers to enhance Augment Agent capabilities.

## 📦 Configured MCP Servers

### 1. **Filesystem** (@modelcontextprotocol/server-filesystem)
**Purpose:** Direct file system access  
**Capabilities:**
- Read/write files
- List directories
- File operations

**Configuration:**
```json
{
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "d:\\Projects\\project-detedxs26"]
}
```

---

### 2. **GitHub** (@modelcontextprotocol/server-github)
**Purpose:** GitHub repository integration  
**Capabilities:**
- Create/list issues
- Create/merge pull requests
- Repository management
- Commit operations

**Setup Required:**
```bash
# Set GitHub token in environment
$env:GITHUB_PERSONAL_ACCESS_TOKEN = "ghp_your_token_here"
```

**Get Token:** https://github.com/settings/tokens

---

### 3. **Memory** (@modelcontextprotocol/server-memory)
**Purpose:** Persistent memory across sessions  
**Capabilities:**
- Store key facts about the project
- Remember user preferences
- Maintain context between sessions

**Usage:**
- Agent automatically stores important information
- Retrieves context in future sessions

---

### 4. **Playwright** (@executeautomation/playwright-mcp-server)
**Purpose:** Browser automation  
**Capabilities:**
- Automated UI testing
- Visual regression testing
- Form filling automation
- Screenshot/video capture

**Use Cases:**
- Test ticketing flow end-to-end
- Verify seat selection UI
- Check responsive design

---

### 5. **Fetch** (@modelcontextprotocol/server-fetch)
**Purpose:** HTTP requests and web scraping  
**Capabilities:**
- Fetch web content
- Call external APIs
- Download resources

**Use Cases:**
- Test payment gateway webhooks
- Fetch documentation
- API integration testing

---

### 6. **Sequential Thinking** (@modelcontextprotocol/server-sequential-thinking)
**Purpose:** Extended reasoning for complex problems  
**Capabilities:**
- Multi-step reasoning
- Complex problem solving
- Architectural decisions

**Use Cases:**
- Design complex features
- Debug difficult issues
- Architecture planning

---

## 🚀 Usage

### Automatic
MCP servers are automatically loaded by Augment Agent when configured in `mcp_settings.json`.

### Manual Invocation
Some servers expose tools you can explicitly call:

```typescript
// Example: Using Playwright for testing
await browser.navigate("http://localhost:3000")
await browser.click("button[data-testid='select-seat-a1']")
await browser.screenshot("seat-selection.png")
```

---

## 🔧 Troubleshooting

### MCP Server Not Found
```bash
# Clear npm cache
npm cache clean --force

# Reinstall
npx -y @modelcontextprotocol/server-filesystem
```

### GitHub Token Issues
```bash
# Verify token is set
echo $env:GITHUB_PERSONAL_ACCESS_TOKEN

# Re-set token
$env:GITHUB_PERSONAL_ACCESS_TOKEN = "ghp_new_token"
```

### Permission Errors
Ensure file paths use absolute paths and have correct permissions.

---

## 📚 Additional MCP Servers

### Optional Servers (Not Configured)

**Database MCP:**
- `@modelcontextprotocol/server-postgres` - PostgreSQL access
- `@modelcontextprotocol/server-sqlite` - SQLite access

**Development:**
- `@modelcontextprotocol/server-git` - Advanced Git operations
- `@modelcontextprotocol/server-docker` - Docker container management

**External Services:**
- `@modelcontextprotocol/server-slack` - Slack integration
- `@modelcontextprotocol/server-google-maps` - Maps API

### To Add More Servers

Edit `.augment/mcp_settings.json`:

```json
{
  "mcpServers": {
    "your-server": {
      "command": "npx",
      "args": ["-y", "@scope/server-name"],
      "env": {
        "API_KEY": "${YOUR_API_KEY}"
      }
    }
  }
}
```

---

## 🔗 Resources

- **MCP Documentation:** https://modelcontextprotocol.io
- **MCP Server Registry:** https://github.com/modelcontextprotocol/servers
- **Augment MCP Guide:** https://docs.augmentcode.com/mcp

---

**Last Updated:** 2026-06-13  
**Configuration File:** `.augment/mcp_settings.json`
