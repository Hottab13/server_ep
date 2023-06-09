const uuid = require("uuid");
const bcrypt = require("bcrypt");

const User = require("../models/user");
const ApiErrors = require("../exceptions/error-api");
const { UserDto } = require("../dtos/auth-dto");
const { sendActivationMail } = require("./mail-service");
const {
  generateAccessToken,
  saveToken,
  removeToken,
  validationRefreshToken,
  findToken,
} = require("./token-service");
const { resUserData } = require("./hook-service");

const saltRounds = 7;

const registrtion = async (email, password, userName) => {
  const activLink = uuid.v4();
  const candidate = await User.findOne({ email });
  if (candidate) {
    throw ApiErrors.BadRequest(`Пользователь ${email} уже существует!`);
  }
  const hashPassword = await bcrypt.hash(password, saltRounds);
  await User.create({
    email,
    password: hashPassword,
    activLink,
    data: {
      userName,
    },
  });
  /*await sendActivationMail(
    email,
    `${process.env.API_URL}api/activate/${activLink}`
  );*/
  return {
    message: `Пользователь ${userName} успешно зарегистрирован! Ввойдите в ваш аккаунт ${email}!`// Пожалуйста активируйте ваш аккаунт с помощью почты ${email}!`,
  };
};
const activate = async (activLink) => {
  const user = await User.findOne({ activLink });
  if (!user) {
    throw ApiErrors.BadRequest(`Некоректная ссылка активации!`);
  }
  user.isActivated = true;
  await user.save();
};
const login = async (email, password) => {
  const userData = await User.findOne({ email });
  if (!userData) {
    throw ApiErrors.BadRequest(`Пользователь ${email} не найден!`);
  }
  const isPassEquals = await bcrypt.compare(password, userData.password);
  if (!isPassEquals) {
    throw ApiErrors.BadRequest(`Не верный пароль!`);
  }
  const resData = await resUserData(userData);
  return resData;
};
const logout = async (refreshToken) => {
  const token = await removeToken(refreshToken);
  return token;
};
const refresh = async (refreshToken) => {
  if (!refreshToken) {
    throw ApiErrors.UnauthorizedError("Токен аунтификации не найден не найден!");
  }
  const reqValidationUser = validationRefreshToken(refreshToken);
  const tokenFreshDb = await findToken(refreshToken);
  if (!reqValidationUser || !tokenFreshDb) {
    throw ApiErrors.UnauthorizedError("Токен не прошел валидацию!");
  }
  const userData = await User.findById(reqValidationUser.id);
  const resData = await resUserData(userData);
  return resData;
};

module.exports = { registrtion, activate, login, logout, refresh };
