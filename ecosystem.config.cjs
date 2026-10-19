module.exports = {
  apps: [
    {
      name: 'doubao-follow',
      script: 'src/follow-await.mjs',
      cwd: '/www/wwwroot/doubao-bot',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/www/wwwroot/doubao-bot/logs/follow-error.log',
      out_file: '/www/wwwroot/doubao-bot/logs/follow-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      restart_delay: 1000,
    },
  ],
}