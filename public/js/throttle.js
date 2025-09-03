function throttle(func, delay) {
    let shouldWait = false;
    let waitingArgs = null;

    const timeoutFunc = () => {
        if (waitingArgs == null) {
            shouldWait = false;
        } else {
            func(...waitingArgs);
            waitingArgs = null;
            setTimeout(timeoutFunc, delay);
        }
    };

    return (...args) => {
        if (shouldWait) {
            waitingArgs = args;
            return;
        }

        func(...args);
        shouldWait = true;
        setTimeout(timeoutFunc, delay);
    };
}

export default throttle;