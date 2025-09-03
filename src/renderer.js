// Renderer process script for window controls and interactions

let isDragging = false;
let dragOffset = { x: 0, y: 0 };

// Wait for DOM to be loaded
document.addEventListener('DOMContentLoaded', () => {
  initializeWindowControls();
  initializeContextMenu();
  initializeDragFunctionality();
  updateAlwaysOnTopStatus();
});

function initializeWindowControls() {
  // Close button
  const closeBtn = document.getElementById('close-btn');
  closeBtn.addEventListener('click', async () => {
    await window.electronAPI.closeWindow();
  });

  // Minimize button
  const minimizeBtn = document.getElementById('minimize-btn');
  minimizeBtn.addEventListener('click', async () => {
    await window.electronAPI.minimizeWindow();
  });

  // Settings button (placeholder for Phase 2)
  const settingsBtn = document.getElementById('settings-btn');
  settingsBtn.addEventListener('click', () => {
    showNotification('Settings will be available in Phase 2');
  });
}

function initializeContextMenu() {
  const contextMenu = document.getElementById('context-menu');
  const overlayContainer = document.querySelector('.overlay-container');
  
  // Show context menu on right-click
  overlayContainer.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY);
  });

  // Hide context menu on click outside
  document.addEventListener('click', () => {
    hideContextMenu();
  });

  // Handle always-on-top toggle
  const toggleAlwaysOnTop = document.getElementById('toggle-always-on-top');
  toggleAlwaysOnTop.addEventListener('click', async (e) => {
    e.stopPropagation();
    const isOnTop = await window.electronAPI.toggleAlwaysOnTop();
    updateAlwaysOnTopStatus(isOnTop);
    hideContextMenu();
  });
}

function initializeDragFunctionality() {
  const headerBar = document.getElementById('header-bar');
  const overlayContainer = document.querySelector('.overlay-container');

  // Mouse down on header starts drag
  headerBar.addEventListener('mousedown', (e) => {
    // Don't start drag if clicking on buttons
    if (e.target.closest('.control-btn')) return;
    
    isDragging = true;
    dragOffset.x = e.clientX;
    dragOffset.y = e.clientY;
    overlayContainer.classList.add('dragging');
    
    // Prevent text selection during drag
    e.preventDefault();
  });

  // Handle drag movement
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragOffset.x;
    const deltaY = e.clientY - dragOffset.y;
    
    // Move window via IPC (this will be handled in main process)
    window.electronAPI.moveWindow(deltaX, deltaY);
    
    dragOffset.x = e.clientX;
    dragOffset.y = e.clientY;
  });

  // End drag on mouse up
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      overlayContainer.classList.remove('dragging');
    }
  });
}

function showContextMenu(x, y) {
  const contextMenu = document.getElementById('context-menu');
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.style.display = 'block';
}

function hideContextMenu() {
  const contextMenu = document.getElementById('context-menu');
  contextMenu.style.display = 'none';
}

async function updateAlwaysOnTopStatus(isOnTop) {
  if (isOnTop === undefined) {
    // Query current status
    isOnTop = await window.electronAPI.isAlwaysOnTop();
  }
  
  const checkMark = document.getElementById('always-on-top-check');
  checkMark.style.display = isOnTop ? 'inline' : 'none';
}

function showNotification(message) {
  // Create a temporary notification
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 11px;
    z-index: 1001;
    animation: fadeInOut 2s ease-in-out;
  `;

  // Add fade animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeInOut {
      0%, 100% { opacity: 0; }
      20%, 80% { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    document.body.removeChild(notification);
    document.head.removeChild(style);
  }, 2000);
}

// Handle keyboard shortcuts (additional to global shortcut)
document.addEventListener('keydown', (e) => {
  // Escape key hides context menu
  if (e.key === 'Escape') {
    hideContextMenu();
  }
});

// Prevent default drag behavior on images and other elements
document.addEventListener('dragstart', (e) => {
  e.preventDefault();
});

// Add some debugging for development
if (process.env.NODE_ENV === 'development') {
  console.log('Classroom Assistant Overlay initialized');
  
  // Add development shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      console.log('Development mode active');
    }
  });
}