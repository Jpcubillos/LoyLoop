import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import {
  Button,
  Feedback,
  Header,
  Icon,
  Screen,
  Tabs,
  Txt,
  ui,
} from "@/components/ui/loyloop";
import { palette as c } from "@/constants/loyloop";
import {
  signInWithEmail,
  signUpWithEmail,
  confirmRegistration,
  resendRegistration,
  requestRecovery,
  recoverPassword,
} from "@/lib/auth";
import { RECOVERY_NOTICE, SIGNUP_NOTICE } from "@/lib/auth-rules";

type Mode =
  | "Entrar"
  | "Crear cuenta"
  | "Confirmar cuenta"
  | "Recuperar acceso"
  | "Nueva contraseña";

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>("Entrar");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [token, setToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inFlight = useRef(false);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(
      () => setCooldown((v) => Math.max(0, v - 1)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [cooldown]);

  const mainMode = mode === "Entrar" || mode === "Crear cuenta";
  const codeMode = mode === "Confirmar cuenta" || mode === "Nueva contraseña";
  const newPassword = mode === "Crear cuenta" || mode === "Nueva contraseña";
  const hasPassword = mode === "Entrar" || newPassword;

  function changeMode(next: Mode) {
    if (inFlight.current) return;
    setMode(next);
    setError("");
    setMessage("");
    setPassword("");
    setConfirmation("");
    setToken("");
    setShowPassword(false);
  }

  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No pudimos completar la solicitud. Inténtalo nuevamente.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function submit() {
    void run(async () => {
      if (mode === "Entrar") {
        await signInWithEmail(email, password);
        setPassword("");
        router.replace("/");
        return;
      }
      if (mode === "Crear cuenta") {
        const session = await signUpWithEmail(
          email,
          password,
          confirmation,
          name,
        );
        setPassword("");
        setConfirmation("");
        if (session) {
          router.replace("/");
          return;
        }
        setMode("Confirmar cuenta");
        setMessage(SIGNUP_NOTICE);
        setCooldown(60);
        return;
      }
      if (mode === "Confirmar cuenta") {
        await confirmRegistration(email, token);
        setToken("");
        router.replace("/");
        return;
      }
      if (mode === "Recuperar acceso") {
        await requestRecovery(email);
        setMode("Nueva contraseña");
        setMessage(RECOVERY_NOTICE);
        setCooldown(60);
        return;
      }
      await recoverPassword(email, token, password, confirmation);
      setPassword("");
      setConfirmation("");
      setToken("");
      setMode("Entrar");
      setMessage(
        "Tu contraseña se actualizó. Inicia sesión con tu nueva contraseña.",
      );
    });
  }

  function resend() {
    if (cooldown || busy) return;
    void run(async () => {
      if (mode === "Confirmar cuenta") {
        await resendRegistration(email);
        setMessage(SIGNUP_NOTICE);
      } else {
        await requestRecovery(email);
        setMessage(RECOVERY_NOTICE);
      }
      setCooldown(60);
    });
  }

  return (
    <Screen tabs={false}>
      <Header title="LoyLoop" back />
      <View style={{ gap: 22, paddingTop: 24 }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 22,
            backgroundColor: c.soft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon
            name={mainMode ? "sparkles-outline" : "shield-checkmark-outline"}
            size={32}
          />
        </View>
        <Txt size={29} weight="bold">
          {mainMode ? "Tus lugares favoritos,\nmás cerca de ti." : mode}
        </Txt>
        <Txt color={c.muted}>
          {mainMode
            ? "Descubre comercios, desbloquea beneficios y encuentra razones para volver."
            : mode === "Recuperar acceso"
              ? "Ingresa tu correo para solicitar un código de recuperación."
              : mode === "Confirmar cuenta"
                ? "Escribe el código que recibiste por correo para confirmar tu cuenta."
                : "Ingresa el código de recuperación y elige tu nueva contraseña."}
        </Txt>
        {mainMode && (
          <View pointerEvents={busy ? "none" : "auto"}>
            <Tabs
              items={["Entrar", "Crear cuenta"] as const}
              value={mode}
              onChange={changeMode}
            />
          </View>
        )}
        {mode === "Crear cuenta" && (
          <Field label="Nombre (opcional)">
            <TextInput
              accessibilityLabel="Nombre"
              value={name}
              onChangeText={setName}
              autoComplete="name"
              maxLength={100}
              editable={!busy}
              style={ui.input}
            />
          </Field>
        )}
        <Field label="Correo electrónico">
          <TextInput
            accessibilityLabel="Correo electrónico"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="tu@correo.com"
            placeholderTextColor={c.muted}
            editable={!busy && !codeMode}
            style={ui.input}
          />
        </Field>
        {codeMode && (
          <Field label="Código del correo">
            <TextInput
              accessibilityLabel="Código del correo"
              value={token}
              onChangeText={(v) => setToken(v.replace(/\D/g, ""))}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={10}
              editable={!busy}
              style={ui.input}
            />
          </Field>
        )}
        {hasPassword && (
          <Field
            label={
              mode === "Nueva contraseña" ? "Nueva contraseña" : "Contraseña"
            }
          >
            <View style={{ position: "relative" }}>
              <TextInput
                accessibilityLabel={
                  mode === "Nueva contraseña"
                    ? "Nueva contraseña"
                    : "Contraseña"
                }
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={newPassword ? "new-password" : "current-password"}
                editable={!busy}
                style={[ui.input, { paddingRight: 56 }]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                }
                onPress={() => setShowPassword((v) => !v)}
                style={{
                  position: "absolute",
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: 52,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  color={c.muted}
                />
              </Pressable>
            </View>
            {newPassword && (
              <Txt size={12} color={c.muted}>
                Al menos 8 caracteres. Usa una contraseña que no utilices en
                otros sitios.
              </Txt>
            )}
          </Field>
        )}
        {newPassword && (
          <Field label="Confirmar contraseña">
            <TextInput
              accessibilityLabel="Confirmar contraseña"
              value={confirmation}
              onChangeText={setConfirmation}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              editable={!busy}
              style={ui.input}
            />
          </Field>
        )}
        <Feedback error={error} />
        {!!message && (
          <View
            accessibilityLiveRegion="polite"
            style={{
              borderRadius: 18,
              backgroundColor: "#F1F9F5",
              padding: 16,
            }}
          >
            <Txt color="#216B48">{message}</Txt>
          </View>
        )}
        <Button
          title={
            mode === "Nueva contraseña"
              ? "Guardar nueva contraseña"
              : mode === "Recuperar acceso"
                ? "Enviar código"
                : mode === "Confirmar cuenta"
                  ? "Confirmar y entrar"
                  : mode
          }
          onPress={submit}
          loading={busy}
          disabled={
            !email.trim() ||
            (hasPassword && !password) ||
            (newPassword && !confirmation) ||
            (codeMode && token.length < 6)
          }
        />
        {mode === "Entrar" && (
          <>
            <Button
              title="Olvidé mi contraseña"
              variant="ghost"
              onPress={() => changeMode("Recuperar acceso")}
              disabled={busy}
            />
            <Button
              title="Tengo un código de confirmación"
              variant="ghost"
              onPress={() => changeMode("Confirmar cuenta")}
              disabled={busy}
            />
          </>
        )}
        {codeMode && (
          <Button
            title={
              cooldown ? `Reenviar código en ${cooldown} s` : "Reenviar código"
            }
            variant="secondary"
            onPress={resend}
            disabled={busy || cooldown > 0}
          />
        )}
        {!mainMode && (
          <Button
            title="Volver al acceso"
            variant="ghost"
            onPress={() => changeMode("Entrar")}
            disabled={busy}
          />
        )}
        <Button
          title="Seguir explorando"
          variant="ghost"
          onPress={() => router.replace("/")}
          disabled={busy}
        />
      </View>
    </Screen>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Txt weight="medium">{label}</Txt>
      {children}
    </View>
  );
}
