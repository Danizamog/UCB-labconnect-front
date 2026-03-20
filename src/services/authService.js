export async function signIn(credentials) {
  const { email, password } = credentials

  return Promise.resolve({
    success: Boolean(email?.trim() && password?.trim()),
  })
}
