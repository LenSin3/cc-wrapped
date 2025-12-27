const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Helper to run git commands
function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 }).trim();
  } catch (e) {
    return '';
  }
}

// Check if we're in a git repo
function isGitRepo() {
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Get git stats for the year
function getGitStats(year) {
  const since = `${year}-01-01`;

  // Total commits
  const totalCommits = parseInt(git(`log --since="${since}" --oneline | wc -l`)) || 0;

  // Lines added/deleted
  const lineStats = git(`log --since="${since}" --format="" --numstat | awk '{added+=$1; deleted+=$2} END {print added, deleted}'`).split(' ');
  const linesAdded = parseInt(lineStats[0]) || 0;
  const linesDeleted = parseInt(lineStats[1]) || 0;

  // Commits by month
  const monthlyRaw = git(`log --since="${since}" --format="%ad" --date=format:"%Y-%m" | sort | uniq -c`);
  const monthly = {};
  monthlyRaw.split('\n').filter(Boolean).forEach(line => {
    const match = line.trim().match(/(\d+)\s+(\d{4}-\d{2})/);
    if (match) {
      monthly[match[2]] = parseInt(match[1]);
    }
  });

  // Commits by day of week
  const dayOfWeekRaw = git(`log --since="${since}" --format="%ad" --date=format:"%A" | sort | uniq -c | sort -rn`);
  const dayOfWeek = {};
  dayOfWeekRaw.split('\n').filter(Boolean).forEach(line => {
    const match = line.trim().match(/(\d+)\s+(\w+)/);
    if (match) {
      dayOfWeek[match[2]] = parseInt(match[1]);
    }
  });

  // Commits by hour
  const hourRaw = git(`log --since="${since}" --format="%ad" --date=format:"%H" | sort | uniq -c | sort -rn | head -5`);
  const topHours = [];
  hourRaw.split('\n').filter(Boolean).forEach(line => {
    const match = line.trim().match(/(\d+)\s+(\d+)/);
    if (match) {
      topHours.push({ hour: parseInt(match[2]), count: parseInt(match[1]) });
    }
  });

  // Bug fixes vs features
  const bugFixes = parseInt(git(`log --since="${since}" --oneline | grep -iE "fix|bug" | wc -l`)) || 0;
  const features = parseInt(git(`log --since="${since}" --oneline | grep -iE "feat|add|implement" | wc -l`)) || 0;

  // Claude Code commits
  const claudeCommits = parseInt(git(`log --since="${since}" --format="%B" | grep -c "Co-Authored-By:"`)) || 0;

  // First and last commit
  const firstCommit = git(`log --since="${since}" --reverse --format="%ad|%s" --date=short | head -1`);
  const lastCommit = git(`log --since="${since}" --format="%ad|%s" --date=short | head -1`);

  // Most productive days
  const productiveDaysRaw = git(`log --since="${since}" --format="%ad" --date=short | sort | uniq -c | sort -rn | head -5`);
  const productiveDays = [];
  productiveDaysRaw.split('\n').filter(Boolean).forEach(line => {
    const match = line.trim().match(/(\d+)\s+(\d{4}-\d{2}-\d{2})/);
    if (match) {
      productiveDays.push({ date: match[2], count: parseInt(match[1]) });
    }
  });

  // Unique days with commits
  const uniqueDays = parseInt(git(`log --since="${since}" --format="%ad" --date=short | uniq | wc -l`)) || 0;

  // Most edited files
  const topFilesRaw = git(`log --since="${since}" --numstat --format="" | awk '{print $3}' | grep -v "^$" | sed 's|.*/||' | sort | uniq -c | sort -rn | head -5`);
  const topFiles = [];
  topFilesRaw.split('\n').filter(Boolean).forEach(line => {
    const match = line.trim().match(/(\d+)\s+(.+)/);
    if (match) {
      topFiles.push({ file: match[2], count: parseInt(match[1]) });
    }
  });

  // Repo name
  const repoName = path.basename(process.cwd());

  return {
    repoName,
    year,
    totalCommits,
    linesAdded,
    linesDeleted,
    netLines: linesAdded - linesDeleted,
    monthly,
    dayOfWeek,
    topHours,
    bugFixes,
    features,
    claudeCommits,
    claudePercentage: totalCommits > 0 ? ((claudeCommits / totalCommits) * 100).toFixed(1) : 0,
    firstCommit: firstCommit.split('|'),
    lastCommit: lastCommit.split('|'),
    productiveDays,
    uniqueDays,
    topFiles
  };
}

// Get Claude Code stats
function getClaudeStats() {
  const statsPath = path.join(os.homedir(), '.claude', 'stats-cache.json');

  if (!fs.existsSync(statsPath)) {
    return null;
  }

  try {
    const data = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));

    // Get model usage
    const modelUsage = data.modelUsage || {};
    let totalInput = 0, totalOutput = 0, totalCacheRead = 0, totalCacheCreation = 0;
    let modelName = 'Unknown';

    for (const [model, usage] of Object.entries(modelUsage)) {
      modelName = model.replace(/-\d+$/, '').replace('claude-', 'Claude ').replace('-', ' ');
      totalInput += usage.inputTokens || 0;
      totalOutput += usage.outputTokens || 0;
      totalCacheRead += usage.cacheReadInputTokens || 0;
      totalCacheCreation += usage.cacheCreationInputTokens || 0;
    }

    const totalTokens = totalInput + totalOutput + totalCacheRead + totalCacheCreation;

    // Daily activity
    const dailyActivity = data.dailyActivity || [];
    const totalMessages = data.totalMessages || dailyActivity.reduce((sum, d) => sum + d.messageCount, 0);
    const totalToolCalls = dailyActivity.reduce((sum, d) => sum + (d.toolCallCount || 0), 0);
    const totalSessions = data.totalSessions || dailyActivity.length;

    // Most active day
    const mostActiveDay = dailyActivity.reduce((max, d) =>
      d.messageCount > (max?.messageCount || 0) ? d : max, null);

    return {
      totalTokens,
      inputTokens: totalInput,
      outputTokens: totalOutput,
      cacheReadTokens: totalCacheRead,
      cacheCreationTokens: totalCacheCreation,
      totalMessages,
      totalToolCalls,
      totalSessions,
      modelName,
      mostActiveDay: mostActiveDay ? {
        date: mostActiveDay.date,
        messages: mostActiveDay.messageCount
      } : null,
      firstSessionDate: data.firstSessionDate
    };
  } catch (e) {
    console.error('Error reading Claude stats:', e.message);
    return null;
  }
}

// Format numbers
function formatNumber(num) {
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(0) + 'K';
  return num.toLocaleString();
}

// Generate HTML
function generateHTML(gitStats, claudeStats, options) {
  const { tokensOnly, gitOnly, year } = options;

  const title = tokensOnly ? 'Claude Code' : (gitStats?.repoName || 'Your Code');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} ${year} Wrapped</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            min-height: 100vh;
            color: #fff;
            padding: 40px 20px;
        }

        .container { max-width: 800px; margin: 0 auto; }

        .header { text-align: center; margin-bottom: 50px; }
        .header h1 {
            font-size: 3.5rem;
            font-weight: 900;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 10px;
        }
        .header .year {
            font-size: 5rem;
            font-weight: 900;
            color: #fff;
            text-shadow: 0 0 40px rgba(102, 126, 234, 0.5);
        }
        .header .subtitle { font-size: 1.2rem; color: #a0aec0; margin-top: 10px; }

        .card {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(10px);
            border-radius: 24px;
            padding: 30px;
            margin-bottom: 24px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .card h2 { font-size: 1.5rem; margin-bottom: 20px; color: #f093fb; }

        .big-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
        @media (min-width: 600px) { .big-stats { grid-template-columns: repeat(4, 1fr); } }

        .stat-box {
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%);
            border-radius: 16px;
            padding: 24px;
            text-align: center;
        }
        .stat-box .number {
            font-size: 2rem;
            font-weight: 800;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .stat-box .label { font-size: 0.9rem; color: #a0aec0; margin-top: 5px; }

        .bar-chart { margin: 15px 0; }
        .bar-row { display: flex; align-items: center; margin-bottom: 12px; }
        .bar-label { width: 100px; font-size: 0.9rem; color: #a0aec0; }
        .bar-container {
            flex: 1;
            height: 24px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            overflow: hidden;
            margin: 0 15px;
        }
        .bar {
            height: 100%;
            border-radius: 12px;
            display: flex;
            align-items: center;
            padding-left: 10px;
            font-size: 0.8rem;
            font-weight: 600;
        }
        .bar.purple { background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); }
        .bar.pink { background: linear-gradient(90deg, #f093fb 0%, #f5576c 100%); }
        .bar.blue { background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%); }
        .bar.green { background: linear-gradient(90deg, #38f9d7 0%, #43e97b 100%); }
        .bar.orange { background: linear-gradient(90deg, #fa709a 0%, #fee140 100%); }
        .bar-value { font-size: 0.9rem; color: #fff; min-width: 50px; text-align: right; }

        .highlight-box {
            background: linear-gradient(135deg, rgba(240, 147, 251, 0.2) 0%, rgba(245, 87, 108, 0.2) 100%);
            border-radius: 16px;
            padding: 20px;
            text-align: center;
            margin-top: 20px;
        }
        .highlight-box .label { color: #a0aec0; font-size: 0.9rem; }
        .highlight-box .value { font-size: 1.5rem; font-weight: 700; color: #f093fb; margin-top: 5px; }

        .achievements { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
        .achievement {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            padding: 15px;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .achievement .emoji { font-size: 1.8rem; }
        .achievement .text { font-size: 0.85rem; }
        .achievement .title { font-weight: 700; color: #fff; }
        .achievement .desc { color: #a0aec0; font-size: 0.8rem; }

        .footer { text-align: center; margin-top: 50px; padding: 30px; }
        .footer .message { font-size: 1.1rem; color: #a0aec0; margin-bottom: 10px; }
        .footer .cta {
            font-size: 2rem;
            font-weight: 800;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .footer .credit { font-size: 0.8rem; color: #667eea; margin-top: 20px; }
        .footer .credit a { color: #f093fb; text-decoration: none; }

        @media print {
            body { background: #1a1a2e; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${title}</h1>
            <div class="year">${year}</div>
            <div class="subtitle">${tokensOnly ? 'Your Claude Code Usage' : 'Your Year in Code'}</div>
        </div>

        ${generateBigNumbers(gitStats, claudeStats, options)}
        ${!tokensOnly && gitStats ? generateGitSections(gitStats) : ''}
        ${!gitOnly && claudeStats ? generateTokenSections(claudeStats) : ''}
        ${generateAchievements(gitStats, claudeStats, options)}

        <div class="footer">
            <div class="message">${getFooterMessage(gitStats, claudeStats, options)}</div>
            <div class="cta">Here's to ${year + 1}!</div>
            <div class="credit">Generated with <a href="https://github.com/yourusername/cc-wrapped">cc-wrapped</a></div>
        </div>
    </div>
</body>
</html>`;
}

function generateBigNumbers(gitStats, claudeStats, options) {
  const { tokensOnly, gitOnly } = options;
  let stats = [];

  if (!gitOnly && claudeStats) {
    stats.push({ number: formatNumber(claudeStats.totalTokens), label: 'Tokens Used' });
    stats.push({ number: formatNumber(claudeStats.totalMessages), label: 'Messages Sent' });
    stats.push({ number: formatNumber(claudeStats.totalToolCalls), label: 'Tool Calls' });
  }

  if (!tokensOnly && gitStats) {
    stats.push({ number: formatNumber(gitStats.totalCommits), label: 'Commits' });
    if (!claudeStats || gitOnly) {
      stats.push({ number: formatNumber(gitStats.linesAdded), label: 'Lines Added' });
    }
  }

  if (!gitOnly && claudeStats) {
    stats.push({ number: claudeStats.totalSessions.toString(), label: 'Sessions' });
  }

  if (!tokensOnly && gitStats) {
    stats.push({ number: formatNumber(gitStats.linesAdded), label: 'Lines Added' });
    stats.push({ number: gitStats.uniqueDays.toString(), label: 'Days Coding' });
  }

  // Deduplicate and limit to 8
  const seen = new Set();
  stats = stats.filter(s => {
    if (seen.has(s.label)) return false;
    seen.add(s.label);
    return true;
  }).slice(0, 8);

  return `
    <div class="card">
      <h2>The Big Numbers</h2>
      <div class="big-stats">
        ${stats.map(s => `
          <div class="stat-box">
            <div class="number">${s.number}</div>
            <div class="label">${s.label}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function generateGitSections(stats) {
  const days = Object.entries(stats.dayOfWeek).sort((a, b) => b[1] - a[1]);
  const maxDayCount = days[0]?.[1] || 1;
  const colors = ['purple', 'pink', 'blue', 'orange', 'green'];

  const months = Object.entries(stats.monthly).sort((a, b) => a[0].localeCompare(b[0]));
  const maxMonthCount = Math.max(...months.map(m => m[1])) || 1;

  const topHours = stats.topHours.slice(0, 3);
  const maxHourCount = topHours[0]?.count || 1;

  return `
    <div class="card">
      <h2>Monthly Activity</h2>
      <div class="bar-chart">
        ${months.map(([month, count], i) => `
          <div class="bar-row">
            <div class="bar-label">${new Date(month + '-01').toLocaleString('en', { month: 'short' })}</div>
            <div class="bar-container">
              <div class="bar ${colors[i % colors.length]}" style="width: ${(count / maxMonthCount) * 100}%;">${count}</div>
            </div>
            <div class="bar-value">${count}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="card">
      <h2>Favorite Day: ${days[0]?.[0] || 'N/A'}</h2>
      <div class="bar-chart">
        ${days.slice(0, 5).map(([day, count], i) => `
          <div class="bar-row">
            <div class="bar-label">${day.slice(0, 3)}</div>
            <div class="bar-container">
              <div class="bar ${colors[i % colors.length]}" style="width: ${(count / maxDayCount) * 100}%;"></div>
            </div>
            <div class="bar-value">${count}</div>
          </div>
        `).join('')}
      </div>
    </div>

    ${topHours.length > 0 ? `
    <div class="card">
      <h2>Most Productive Hours</h2>
      <div class="bar-chart">
        ${topHours.map((h, i) => `
          <div class="bar-row">
            <div class="bar-label">${h.hour === 0 ? '12 AM' : h.hour < 12 ? h.hour + ' AM' : h.hour === 12 ? '12 PM' : (h.hour - 12) + ' PM'}</div>
            <div class="bar-container">
              <div class="bar ${colors[i % colors.length]}" style="width: ${(h.count / maxHourCount) * 100}%;"></div>
            </div>
            <div class="bar-value">${h.count}</div>
          </div>
        `).join('')}
      </div>
      ${topHours[0]?.hour >= 22 || topHours[0]?.hour <= 4 ? '<div class="highlight-box"><div class="label">Night Owl Developer!</div></div>' : ''}
    </div>
    ` : ''}

    ${stats.claudeCommits > 0 ? `
    <div class="card">
      <h2>Claude Code Partnership</h2>
      <div style="display: flex; align-items: center; justify-content: center; gap: 20px; margin-top: 20px;">
        <div style="font-size: 3rem; font-weight: 900; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${stats.claudePercentage}%</div>
        <div style="color: #a0aec0;">
          <strong style="color: #fff;">${stats.claudeCommits} commits</strong><br>
          made with Claude Code
        </div>
      </div>
    </div>
    ` : ''}
  `;
}

function generateTokenSections(stats) {
  const maxTokens = Math.max(stats.outputTokens, stats.inputTokens, stats.cacheReadTokens / 100, stats.cacheCreationTokens / 10) || 1;

  return `
    <div class="card">
      <h2>Token Breakdown</h2>
      <div class="bar-chart">
        <div class="bar-row">
          <div class="bar-label" style="width: 120px;">Output</div>
          <div class="bar-container">
            <div class="bar purple" style="width: ${Math.min((stats.outputTokens / maxTokens) * 100, 100)}%;"></div>
          </div>
          <div class="bar-value">${formatNumber(stats.outputTokens)}</div>
        </div>
        <div class="bar-row">
          <div class="bar-label" style="width: 120px;">Input</div>
          <div class="bar-container">
            <div class="bar pink" style="width: ${Math.min((stats.inputTokens / maxTokens) * 100, 100)}%;"></div>
          </div>
          <div class="bar-value">${formatNumber(stats.inputTokens)}</div>
        </div>
        <div class="bar-row">
          <div class="bar-label" style="width: 120px;">Cache Read</div>
          <div class="bar-container">
            <div class="bar blue" style="width: 100%;"></div>
          </div>
          <div class="bar-value">${formatNumber(stats.cacheReadTokens)}</div>
        </div>
        <div class="bar-row">
          <div class="bar-label" style="width: 120px;">Cache Created</div>
          <div class="bar-container">
            <div class="bar green" style="width: ${Math.min((stats.cacheCreationTokens / stats.cacheReadTokens) * 100, 100)}%;"></div>
          </div>
          <div class="bar-value">${formatNumber(stats.cacheCreationTokens)}</div>
        </div>
      </div>
      ${stats.mostActiveDay ? `
        <div class="highlight-box">
          <div class="label">Most Active Day</div>
          <div class="value">${stats.mostActiveDay.date} - ${formatNumber(stats.mostActiveDay.messages)} messages!</div>
        </div>
      ` : ''}
      <p style="text-align: center; color: #a0aec0; font-size: 0.9rem; margin-top: 15px;">Powered by ${stats.modelName}</p>
    </div>
  `;
}

function generateAchievements(gitStats, claudeStats, options) {
  const achievements = [];

  if (claudeStats) {
    if (claudeStats.totalTokens >= 1e9) {
      achievements.push({ emoji: '🔥', title: 'Token Titan', desc: formatNumber(claudeStats.totalTokens) + ' tokens' });
    } else if (claudeStats.totalTokens >= 1e6) {
      achievements.push({ emoji: '⚡', title: 'Token Master', desc: formatNumber(claudeStats.totalTokens) + ' tokens' });
    }

    if (claudeStats.totalMessages >= 10000) {
      achievements.push({ emoji: '💬', title: 'Conversation King', desc: formatNumber(claudeStats.totalMessages) + ' messages' });
    }

    if (claudeStats.totalToolCalls >= 5000) {
      achievements.push({ emoji: '🛠️', title: 'Tool Wielder', desc: formatNumber(claudeStats.totalToolCalls) + ' tool calls' });
    }
  }

  if (gitStats) {
    if (gitStats.totalCommits >= 500) {
      achievements.push({ emoji: '💯', title: 'Commit Machine', desc: gitStats.totalCommits + ' commits' });
    } else if (gitStats.totalCommits >= 100) {
      achievements.push({ emoji: '🎯', title: 'Century Club', desc: gitStats.totalCommits + ' commits' });
    }

    if (gitStats.bugFixes >= 100) {
      achievements.push({ emoji: '🐛', title: 'Bug Exterminator', desc: gitStats.bugFixes + ' bugs squashed' });
    }

    if (gitStats.claudeCommits > 0 && parseFloat(gitStats.claudePercentage) >= 50) {
      achievements.push({ emoji: '🤝', title: 'Dynamic Duo', desc: gitStats.claudePercentage + '% with Claude' });
    }

    const nightCommits = gitStats.topHours.filter(h => h.hour >= 22 || h.hour <= 4).reduce((s, h) => s + h.count, 0);
    if (nightCommits >= 20) {
      achievements.push({ emoji: '🌙', title: 'Night Owl', desc: nightCommits + ' late-night commits' });
    }
  }

  if (achievements.length === 0) {
    achievements.push({ emoji: '🚀', title: 'Builder', desc: 'Shipped code this year!' });
  }

  return `
    <div class="card">
      <h2>Achievements Unlocked</h2>
      <div class="achievements">
        ${achievements.map(a => `
          <div class="achievement">
            <div class="emoji">${a.emoji}</div>
            <div class="text">
              <div class="title">${a.title}</div>
              <div class="desc">${a.desc}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function getFooterMessage(gitStats, claudeStats, options) {
  if (options.tokensOnly) {
    return `${formatNumber(claudeStats?.totalTokens || 0)} tokens of AI-powered development`;
  }
  if (options.gitOnly) {
    return `${gitStats?.totalCommits || 0} commits of building something great`;
  }
  return `From first commit to production - what a journey!`;
}

// Main function
async function generateWrapped(options) {
  const { tokensOnly, gitOnly, year, outputPath, openBrowser } = options;

  console.log(`\n🎁 Generating your ${year} Wrapped...\n`);

  let gitStats = null;
  let claudeStats = null;

  // Get git stats if needed
  if (!tokensOnly) {
    if (!isGitRepo()) {
      if (gitOnly) {
        console.error('❌ Not a git repository. Run this command inside a git repo.');
        process.exit(1);
      }
      console.log('⚠️  Not a git repository. Skipping git stats.');
    } else {
      console.log('📊 Analyzing git history...');
      gitStats = getGitStats(year);
      console.log(`   Found ${gitStats.totalCommits} commits`);
    }
  }

  // Get Claude stats if needed
  if (!gitOnly) {
    console.log('🤖 Looking for Claude Code stats...');
    claudeStats = getClaudeStats();
    if (claudeStats) {
      console.log(`   Found ${formatNumber(claudeStats.totalTokens)} tokens used`);
    } else {
      if (tokensOnly) {
        console.error('❌ No Claude Code stats found at ~/.claude/stats-cache.json');
        process.exit(1);
      }
      console.log('   No Claude Code stats found (that\'s okay!)');
    }
  }

  // Generate HTML
  console.log('✨ Generating wrapped...');
  const html = generateHTML(gitStats, claudeStats, options);

  // Write file
  const fullPath = path.resolve(outputPath);
  fs.writeFileSync(fullPath, html);
  console.log(`📄 Saved to ${fullPath}`);

  // Open in browser
  if (openBrowser) {
    console.log('🌐 Opening in browser...');
    const open = (await import('open')).default;
    await open(fullPath);
  }

  console.log('\n🎉 Done! Share your wrapped on social media!\n');
}

module.exports = { generateWrapped };
