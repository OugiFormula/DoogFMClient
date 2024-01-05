const { app, BrowserWindow, ipcMain, shell } = require('electron');
const DiscordRPC = require('discord-rpc');

let mainWindow;
let rpc;

// Function to check if the app is running in Electron
function isElectron() {
  return typeof process !== 'undefined' && process.versions && !!process.versions.electron;
}

async function createWindow() {
  app.allowRendererProcessReuse = true;

  mainWindow = new BrowserWindow({
    width: 500,
    height: 1100,
    webPreferences: {
      enableRemoteModule: true,
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  

  DiscordRPC.register('DISCORD-CLIENT-ID');
  rpc = new DiscordRPC.Client({ transport: 'ipc' });

  try {
    await rpc.login({ clientId: 'DISCORD-CLIENT-ID' });
    console.log('Discord RPC connected.');
  } catch (error) {
    console.error('Error connecting to Discord RPC:', error.message);
  }

  mainWindow.loadURL('https://doog.cool/DoogFM');
  mainWindow.removeMenu();

  mainWindow.webContents.on('dom-ready', () => {
    mainWindow.webContents.executeJavaScript(`
      (function() {
        document.addEventListener('click', (e) => {
          if (e.target.tagName === 'A' && e.target.getAttribute('target') === '_blank') {
            e.preventDefault();
            require('electron').shell.openExternal(e.target.href);
          }
        });
      })();
    `).catch((error) => {
      console.error('Error injecting script:', error.message);
    });

    mainWindow.webContents.send('webview-ready');
  });

  // Check if running in Electron and send the information to the renderer process
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('electron-check', isElectron());
  });

  ipcMain.on('renderer-error', (event, data) => {
    console.error('Renderer Error:', data);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Check for radio info every 30 seconds
  setInterval(() => {
    mainWindow.webContents.executeJavaScript(`
      (function() {
        const currentStation = document.querySelector('.currentStation p').innerText;
        const radioInputUrl = document.querySelector('.radioinput').value;
        return [currentStation, radioInputUrl];
      })();
    `)
      .then(([stationName, stationLink]) => {
        updateRichPresence(stationName, stationLink);
      })
      .catch((error) => {
        console.error('Error fetching radio info:', error.message);
      });
  }, 30000); // 30 seconds interval
}

function updateRichPresence(stationName, stationLink) {
  try {
    const doogFMUrl = isValidUrl('https://doog.cool/DoogFM') ? new URL('https://doog.cool/DoogFM') : 'https://doog.cool/DoogFM';
    const stationUrl = isValidUrl(stationLink) ? new URL(stationLink) : 'https://doog.cool/play';

    rpc.setActivity({
      details: 'Listening to ',
      state: stationName,
      largeImageKey: 'large',
      startTimestamp: new Date(),
      largeImageText: 'DoogFM Client 1.2.2',
      buttons: [
        { label: 'Listen At DoogFM', url: doogFMUrl.toString() },
        { label: 'Radio Station', url: stationUrl.toString() },
      ],
    });
  } catch (error) {
    console.error('Error setting Discord RPC activity:', error);
  }
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

app.commandLine.appendSwitch('ignore-certificate-errors');

app.whenReady().then(createWindow);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
