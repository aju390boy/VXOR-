function validateAddressForm(form) {
    let isValid = true;

    // Extract fields
    const name = form.querySelector('[name="name"]');
    const mobile = form.querySelector('[name="mobile"]');
    const address1 = form.querySelector('[name="address1"]');
    const city = form.querySelector('[name="city"]');
    const state = form.querySelector('[name="state"]');
    const pincode = form.querySelector('[name="pincode"]');
    const country = form.querySelector('[name="country"]');
    
    // Helper to show error
    function showError(input, message) {
        input.classList.add('border-red-500');
        let errorMsg = form.querySelector(`#${input.name}Error`);
        if (!errorMsg) {
            errorMsg = document.createElement('div');
            errorMsg.className = 'error-message text-red-500 text-xs mt-1';
            errorMsg.id = `${input.name}Error`;
            input.parentNode.appendChild(errorMsg);
        }
        errorMsg.textContent = message;
        isValid = false;
    }
    
    // Reset previous errors
    clearErrorMessages(form);

    // Validation rules
    if (!name.value.trim()) showError(name, "Name is required.");
    if (!mobile.value.match(/^[6-9]\d{9}$/))
        showError(mobile, "Enter valid 10-digit mobile number.");
    if (!address1.value.trim()) showError(address1, "Address is required.");
    if (!city.value.trim()) showError(city, "City is required.");
    if (!state.value.trim()) showError(state, "State is required.");
    if (!pincode.value.match(/^\d{6}$/))
        showError(pincode, "Pincode must be 6 digits.");
    if (!country.value.trim()) showError(country, "Country is required.");

    // Return validity
    return isValid;
}

module.exports = {validateAddressForm};
