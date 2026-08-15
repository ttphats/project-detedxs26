module.exports = {
  apps: [
    {
      name: 'tedx-backend',
      script: './dist/index.js',
      instances: 1, // or 'max' for cluster mode
      exec_mode: 'fork', // or 'cluster'
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      // PM2 will auto-restart the app if it crashes
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      
      // Logging
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      
      // Advanced features
      merge_logs: true,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],

  deploy: {
    production: {
      user: 'ubuntu', // Change to your server user
      host: 'your-server-ip', // Change to your server IP
      ref: 'origin/main', // or 'origin/master'
      repo: 'git@github.com:yourusername/your-repo.git', // Your git repo
      path: '/var/www/tedx-backend',
      'post-deploy':
        'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      env: {
        NODE_ENV: 'production',
      },
    },
  },
};
