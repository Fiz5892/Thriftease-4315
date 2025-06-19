import crypto from "crypto";

const c1 = crypto.randomInt(1000, 9999).toString(); // menghasilkan 4 digit OTP
console.log(c1);