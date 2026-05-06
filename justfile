bundle_name := "todoist-mcp-server.mcpb"
stage_dir   := "build-mcpb"

# List available recipes
default:
    @just --list

# Install npm dependencies
install:
    npm install

# Compile TypeScript to dist/
build: install
    npm run build

# Run the server in dev mode (tsx, reads .env)
run: install
    npm run dev

# Build a Claude Desktop installable .mcpb bundle
bundle: build
    rm -rf {{stage_dir}}
    mkdir -p {{stage_dir}}/server
    cp manifest.json {{stage_dir}}/manifest.json
    cp -r dist {{stage_dir}}/server/dist
    cp package.json package-lock.json {{stage_dir}}/server/
    cd {{stage_dir}}/server && npm ci --omit=dev --ignore-scripts
    npx --yes @anthropic-ai/mcpb pack {{stage_dir}} {{bundle_name}}
    rm -rf {{stage_dir}}
    @echo "\nBuilt {{bundle_name}} — double-click it to install in Claude Desktop."

# Remove build artifacts
clean:
    rm -rf dist {{stage_dir}} {{bundle_name}}
