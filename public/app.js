const API_URL = '/api';

// NOTIFICATION
function showNotification(
  message,
  type = 'info',
  duration = 3000
) {

  const notification =
    document.createElement('div');

  notification.className =
    `notification notification-${type}`;

  notification.textContent =
    message;

  document.body.appendChild(
    notification
  );

  // SHOW
  setTimeout(() => {

    notification.classList.add(
      'show'
    );

  }, 10);

  // HIDE
  setTimeout(() => {

    notification.classList.remove(
      'show'
    );

    setTimeout(() => {

      notification.remove();

    }, 300);

  }, duration);
}

// CHECK STATUS
async function checkBotStatus() {

  try {

    const response =
      await fetch(
        `${API_URL}/bot/status`
      );

    const data =
      await response.json();

    const statusDot =
      document.getElementById(
        'statusDot'
      );

    const statusText =
      document.getElementById(
        'statusText'
      );

    const qrSection =
      document.getElementById(
        'qrSection'
      );

    const readySection =
      document.getElementById(
        'readySection'
      );

    // BOT READY
    if (data.isReady) {

      statusDot.classList.add(
        'active'
      );

      statusText.textContent =
        'Bot Connected';

      qrSection.style.display =
        'none';

      readySection.style.display =
        'block';

    }

    // QR READY
    else if (data.hasQRCode) {

      statusDot.classList.remove(
        'active'
      );

      statusText.textContent =
        'Waiting QR Scan';

      qrSection.style.display =
        'block';

      readySection.style.display =
        'none';

      loadQRCode();
    }

    // OFFLINE
    else {

      statusDot.classList.remove(
        'active'
      );

      statusText.textContent =
        'Bot Offline';

      qrSection.style.display =
        'none';

      readySection.style.display =
        'none';
    }

  } catch (error) {

    console.log(error);
  }
}

// LOAD QR
async function loadQRCode() {

  try {

    const response =
      await fetch(
        `${API_URL}/bot/qr`
      );

    const data =
      await response.json();

    if (data.qr) {

      const qrContainer =
        document.getElementById(
          'qrcode'
        );

      qrContainer.innerHTML =
        `
        <img
          src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data.qr)}"
        />
        `;
    }

  } catch (error) {

    console.log(error);
  }
}

// START BUTTON
document
  .getElementById('startBtn')
  .addEventListener(
    'click',
    async () => {

      try {

        const response =
          await fetch(
            `${API_URL}/bot/start`,
            {
              method: 'POST'
            }
          );

        const data =
          await response.json();

        showNotification(
          data.message,
          'success'
        );

        // CHECK QR
        setTimeout(() => {

          checkBotStatus();

        }, 3000);

      } catch (error) {

        console.log(error);

        showNotification(
          'Error start bot',
          'error'
        );
      }
    }
  );

// AUTO REFRESH STATUS
checkBotStatus();

setInterval(
  checkBotStatus,
  5000
);