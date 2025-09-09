async function updateCartCount() {

    console.log("updatecartcount function is hitted");
    const badge = document.getElementById('cart-count-badge');
    if (!badge) return; 

    try {
        const response = await fetch('/user/cart/count'); 
        if (!response.ok) return;

        const data = await response.json();

        if (data.success) {
            if (data.count > 0) {
                badge.innerText = data.count;
                badge.classList.remove('hidden');
                badge.classList.add('flex');
            } else {
                badge.classList.add('hidden'); 
                badge.classList.remove('flex');
            }
        }
    } catch (error) {
        console.error('Failed to update cart count:', error);
    }
}