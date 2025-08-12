document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  // Get current blocklists and status
  const status = await sendMessage({ action: "getStatus" });
  const defaultLists = await sendMessage({ action: "getDefaultLists" });

  if (status.success) {
    renderBlocklists(status.blockLists);
  }

  if (defaultLists.success) {
    renderRecommendedLists(defaultLists.defaultLists, status.blockLists);
  }

  // Set up event listeners
  document.getElementById("addListBtn").addEventListener("click", addBlocklist);
  document
    .getElementById("importListBtn")
    .addEventListener("click", importBlocklist);
  document
    .getElementById("backBtn")
    .addEventListener("click", () => window.close());
}

function renderBlocklists(blocklists) {
  const container = document.getElementById("blocklistsContainer");
  container.innerHTML = "";

  if (!blocklists || blocklists.length === 0) {
    container.innerHTML = '<div class="empty-list">No blocklists added</div>';
    return;
  }

  blocklists.forEach((list, index) => {
    const listItem = document.createElement("div");
    listItem.className = `blocklist-item ${
      list.enabled ? "enabled" : "disabled"
    }`;
    listItem.innerHTML = `
      <div class="blocklist-info">
        <div class="blocklist-name">${escapeHtml(list.name)}</div>
        <div class="blocklist-url">${escapeHtml(list.url)}</div>
      </div>
      <div class="blocklist-actions">
        <label class="toggle">
          <input type="checkbox" data-index="${index}" class="toggle-list" ${
      list.enabled ? "checked" : ""
    }>
          <span class="toggle-slider"></span>
        </label>
        <button class="btn-remove" data-index="${index}">
          <span class="btn-remove-icon">×</span>
        </button>
      </div>
    `;
    container.appendChild(listItem);
  });

  // Add event listeners for toggle and remove buttons
  document.querySelectorAll(".toggle-list").forEach((toggle) => {
    toggle.addEventListener("change", toggleBlocklist);
  });

  document.querySelectorAll(".btn-remove").forEach((button) => {
    button.addEventListener("click", removeBlocklist);
  });
}

function renderRecommendedLists(recommendedLists, currentLists) {
  const container = document.getElementById("recommendedLists");
  container.innerHTML = "";

  if (!recommendedLists || recommendedLists.length === 0) {
    container.innerHTML =
      '<div class="empty-list">No recommended lists available</div>';
    return;
  }

  // Get URLs of current lists to check if recommended lists are already added
  const currentUrls = currentLists.map((list) => list.url);

  recommendedLists.forEach((list, index) => {
    const isAdded = currentUrls.includes(list.url);

    const listItem = document.createElement("div");
    listItem.className = "recommended-list-item";
    listItem.innerHTML = `
      <div class="recommended-list-info">
        <div class="recommended-list-name">${list.name}</div>
        <div class="recommended-list-description">${list.description}</div>
      </div>
      <div class="recommended-list-actions">
        <button class="btn ${isAdded ? "btn-secondary added" : "btn-primary"}" 
                data-index="${index}" 
                ${isAdded ? "disabled" : ""}>
          ${isAdded ? "Added" : "Add"}
        </button>
      </div>
    `;
    container.appendChild(listItem);
  });

  // Add event listeners for add buttons
  document
    .querySelectorAll(".recommended-list-actions .btn:not(.added)")
    .forEach((button) => {
      button.addEventListener("click", (e) => {
        const index = parseInt(e.target.dataset.index);
        addRecommendedList(recommendedLists[index]);
      });
    });
}

async function addBlocklist() {
  const nameInput = document.getElementById("listName");
  const urlInput = document.getElementById("listUrl");

  const name = nameInput.value.trim();
  const url = urlInput.value.trim();

  if (!name || !url) {
    showMessage("Name and URL are required", "error");
    return;
  }

  const result = await sendMessage({
    action: "addBlocklist",
    name,
    url,
  });

  if (result.success) {
    // Clear inputs
    nameInput.value = "";
    urlInput.value = "";

    // Update UI
    renderBlocklists(result.blockLists);
    showMessage("Blocklist added successfully", "success");
  } else {
    showMessage(`Failed to add blocklist: ${result.error}`, "error");
  }
}

async function importBlocklist() {
  const fileInput = document.getElementById("listFile");
  const file = fileInput.files[0];

  if (!file) {
    showMessage("Please select a file to import", "error");
    return;
  }

  try {
    // Read file content
    const content = await readFileContent(file);

    // Add as a new blocklist
    const result = await sendMessage({
      action: "addBlocklist",
      name: file.name,
      url: `data:text/plain;base64,${btoa(content)}`,
    });

    if (result.success) {
      // Clear input
      fileInput.value = "";

      // Update UI
      renderBlocklists(result.blockLists);
      showMessage(`Imported ${file.name} successfully`, "success");
    } else {
      showMessage(`Failed to import blocklist: ${result.error}`, "error");
    }
  } catch (error) {
    showMessage(`Error importing file: ${error.message}`, "error");
  }
}

function readFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      resolve(e.target.result);
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsText(file);
  });
}

async function toggleBlocklist(event) {
  const index = parseInt(event.target.dataset.index);

  const result = await sendMessage({
    action: "toggleBlocklist",
    index,
  });

  if (result.success) {
    // Update UI
    renderBlocklists(result.blockLists);
  } else {
    showMessage(`Failed to toggle blocklist: ${result.error}`, "error");
    // Reset toggle to previous state
    event.target.checked = !event.target.checked;
  }
}

async function removeBlocklist(event) {
  const index = parseInt(event.target.dataset.index);

  if (!confirm("Are you sure you want to remove this blocklist?")) {
    return;
  }

  const result = await sendMessage({
    action: "removeBlocklist",
    index,
  });

  if (result.success) {
    // Update UI
    renderBlocklists(result.blockLists);
    showMessage("Blocklist removed successfully", "success");
  } else {
    showMessage(`Failed to remove blocklist: ${result.error}`, "error");
  }
}

async function addRecommendedList(list) {
  const result = await sendMessage({
    action: "addBlocklist",
    name: list.name,
    url: list.url,
  });

  if (result.success) {
    // Get latest status to update both lists
    const status = await sendMessage({ action: "getStatus" });
    const defaultLists = await sendMessage({ action: "getDefaultLists" });

    if (status.success) {
      renderBlocklists(status.blockLists);
    }

    if (defaultLists.success) {
      renderRecommendedLists(defaultLists.defaultLists, status.blockLists);
    }

    showMessage(`Added ${list.name} successfully`, "success");
  } else {
    showMessage(`Failed to add ${list.name}: ${result.error}`, "error");
  }
}

function showMessage(message, type = "error") {
  console.log(`${type.toUpperCase()}:`, message);

  // Create a message element
  const container = document.querySelector(".container");
  if (container) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `${type}-message`;
    messageDiv.textContent = message;

    // Remove any existing messages of the same type
    const existingMessage = container.querySelector(`.${type}-message`);
    if (existingMessage) {
      existingMessage.remove();
    }

    // Add the message at the top after the header
    const header = container.querySelector(".header");
    if (header && header.nextSibling) {
      container.insertBefore(messageDiv, header.nextSibling);
    } else {
      container.insertBefore(messageDiv, container.firstChild);
    }

    // Auto-remove after 5 seconds for success messages, 8 seconds for errors
    const timeout = type === "success" ? 5000 : 8000;
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.remove();
      }
    }, timeout);
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(response || { success: false, error: "No response" });
    });
  });
}
