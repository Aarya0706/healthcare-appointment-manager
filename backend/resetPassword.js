const bcrypt = require("bcryptjs");
const prisma = require("./src/config/db");

async function resetPassword() {
  try {
    const passwordHash = await bcrypt.hash("TestDoctor123", 10);

    await prisma.user.update({
      where: {
        email: "testdoctor@clinic.dev"
      },
      data: {
        passwordHash
      }
    });

    console.log("Password reset successfully!");
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

resetPassword();