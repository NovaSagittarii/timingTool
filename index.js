const {app, BrowserWindow, dialog, ipcMain, Menu, MenuItem} = require('electron');
const fs = require('fs');
const path = require('path');
const prompt = require('electron-prompt');

function createWindow () {
  let dir;
  const mainWindow = new BrowserWindow({
    width: 1080,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true
    }
  });
  mainWindow.loadFile('index.html');
  //mainWindow.webContents.openDevTools({mode: 'detach'})

  /*ipcMain.handle('AUDIO', (e, d) => {
    mainWindow.webContents.send('AUDIO', fs.readFileSync(dir, d));
  });*/

  const menu = new Menu()
  menu.append(new MenuItem({
    label: 'File',
    submenu: [{
      label: 'Import',
      // accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Alt+Shift+I',
      click: () => {
        dialog.showOpenDialog({title: 'open song folder', properties: ['openDirectory']}).then(d => {
          if(d.canceled) return;
          dir = d.filePaths[0];
          if(!dir) return;
          const files = fs.readdirSync(dir).filter(n => n.endsWith('.osu'));
          if(!files.length) return;
          prompt({
            title: "Difficulty Select",
            label: "Choose a difficulty",
            type: "select",
            alwaysOnTop: true,
            resizable: true,
            minWidth: mainWindow.getSize()[0],
            selectOptions: files,
          }).then(d => {
            mainWindow.webContents.send('DIR', dir);
            mainWindow.webContents.send('TITLE', files[d]);
            mainWindow.webContents.send('IMPORT', fs.readFileSync(path.join(dir, files[d]), 'utf8'));
          });
        })
      }
    }]
  }));
  menu.append(new MenuItem({
    label: 'Debug',
    submenu: [{
      label: 'Open Dev tools',
      accelerator: 'f12',
      click: () => mainWindow.webContents.openDevTools({mode: 'detach'})
    }]
  }));
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})
