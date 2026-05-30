(function () {
  const payButton = document.getElementById('pay-button');
  const message = document.getElementById('payment-message');

  if (!payButton || !message) {
    return;
  }

  function setMessage(text, isError) {
    message.textContent = text;
    message.classList.toggle('is-error', Boolean(isError));
  }

  async function readJson(response) {
    return response.json().catch(() => ({}));
  }

  async function createOrder() {
    const response = await fetch('/payment/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const data = await readJson(response);

    if (!response.ok) {
      throw new Error(data.error || 'Unable to create payment order');
    }

    return data;
  }

  async function verifyPayment(paymentResponse) {
    const response = await fetch('/payment/verify-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentResponse),
    });
    const data = await readJson(response);

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Payment verification failed');
    }

    window.location.href = data.redirectUrl || '/';
  }

  payButton.addEventListener('click', async () => {
    payButton.disabled = true;
    setMessage('Opening secure checkout...', false);

    try {
      if (typeof Razorpay === 'undefined') {
        throw new Error('Razorpay checkout did not load. Check your internet connection and try again.');
      }

      const order = await createOrder();
      const displayAmount = order.displayAmount || Math.round(Number(order.amount || 0) / 100);

      const checkout = new Razorpay({
        key: order.key,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'EduStreamiX',
        description: `Site unlock access - Rs. ${displayAmount}`,
        order_id: order.orderId,
        handler: async function (paymentResponse) {
          payButton.disabled = true;
          setMessage('Verifying payment...', false);
          await verifyPayment(paymentResponse);
        },
        theme: {
          color: '#f4b321',
        },
        modal: {
          ondismiss: function () {
            payButton.disabled = false;
            setMessage('', false);
          },
        },
      });

      checkout.open();
      setMessage('', false);
    } catch (error) {
      payButton.disabled = false;
      setMessage(error.message || 'Something went wrong. Please try again.', true);
    }
  });
})();
