#include <Arduino.h>
#include <WiFi.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <EEPROM.h>
#include <PubSubClient.h>

// ==================== WI-FI / MQTT ====================
const char* WIFI_SSID = "Wokwi-GUEST";
const char* WIFI_PASSWORD = "";

// Altere somente esta variável para identificar outro dispositivo.
const char* DEVICE = "003";

const char* MQTT_BROKER = "184.195.90.61";
const uint16_t MQTT_PORT = 1883;

// Identificação e tópicos montados automaticamente a partir de DEVICE.
const String TOPIC_PREFIX = String("lamp") + DEVICE;
const String MQTT_CLIENT_ID = String("fiware_") + DEVICE;
const String MQTT_TOPIC_SUBSCRIBE = String("/TEF/") + TOPIC_PREFIX + "/cmd";
const String MQTT_TOPIC_PUBLISH = String("/TEF/") + TOPIC_PREFIX + "/attrs";
const String MQTT_TOPIC_LUMINOSITY = MQTT_TOPIC_PUBLISH + "/l";
const String MQTT_TOPIC_TEMPERATURE = MQTT_TOPIC_PUBLISH + "/t";
const String MQTT_TOPIC_HUMIDITY = MQTT_TOPIC_PUBLISH + "/h";
const String MQTT_TOPIC_COMMAND_EXECUTE = String("/TEF/") + TOPIC_PREFIX + "/cmdexe";

// ==================== PINOS (diagram.json) ====================
// DHT22: conectado à linha 9 da protoboard, compartilhada com GPIO5 (D5).
constexpr uint8_t PIN_DHT = 5;
#define DHT_TYPE DHT22

constexpr uint8_t PIN_LDR = 34;

constexpr uint8_t PIN_LED_AMARELO = 2;
constexpr uint8_t PIN_LED_VERDE = 4;
constexpr uint8_t PIN_LED_VERMELHO = 15;

constexpr uint8_t PIN_BUZZER = 23;

constexpr uint8_t PIN_BTN_LIGAR = 19;
constexpr uint8_t PIN_BTN_DESLIGAR = 18;

constexpr uint8_t PIN_SDA_LCD = 21;
constexpr uint8_t PIN_SCL_LCD = 22;

// ==================== LIMITES AMBIENTAIS ====================
constexpr float TEMP_MIN = 10.0;
constexpr float TEMP_MAX = 27.0;

constexpr float UMID_MIN = 50.0;
constexpr float UMID_MAX = 80.0;

constexpr int LUZ_BAIXA = 0;
constexpr int LUZ_ALTA = 60;

// ==================== OBJETOS ====================
WiFiClient espClient;
PubSubClient mqtt(espClient);
LiquidCrystal_I2C lcd(0x27, 16, 2);
DHT dht(PIN_DHT, DHT_TYPE);

// ==================== ESTADO ====================
bool sistemaLigado = true;
bool alertaCritico = false;
float temperatura = NAN;
float umidade = NAN;
int luminosidade = 0;
uint8_t paginaLCD = 0;

unsigned long ultimaLeitura = 0;
unsigned long ultimoEnvioMQTT = 0;
unsigned long ultimaAtualizacaoLCD = 0;

constexpr unsigned long INTERVALO_LEITURA = 1000;
constexpr unsigned long INTERVALO_MQTT = 5000;
constexpr unsigned long INTERVALO_LCD = 1000;

// ==================== PROTÓTIPOS ====================
void conectarWiFi();
void conectarMQTT();
void callbackMQTT(char* topic, byte* payload, unsigned int length);
void lerSensores();
void atualizarLEDsEBuzzer();
void atualizarLCD();
void publicarDados();
void publicarEstadoSistema();
void atualizarBotoes();

// ==================== SETUP ====================
void setup() {
  Serial.begin(115200);

  pinMode(PIN_BTN_LIGAR, INPUT_PULLUP);
  pinMode(PIN_BTN_DESLIGAR, INPUT_PULLUP);

  pinMode(PIN_LED_AMARELO, OUTPUT);
  pinMode(PIN_LED_VERDE, OUTPUT);
  pinMode(PIN_LED_VERMELHO, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);

  digitalWrite(PIN_LED_AMARELO, LOW);
  digitalWrite(PIN_LED_VERDE, LOW);
  digitalWrite(PIN_LED_VERMELHO, LOW);
  digitalWrite(PIN_BUZZER, LOW);

  analogReadResolution(12);

  Wire.begin(PIN_SDA_LCD, PIN_SCL_LCD);
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Asia.dev");
  lcd.setCursor(0, 1);
  lcd.print("Iniciando...");

  dht.begin();

  conectarWiFi();
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt.setCallback(callbackMQTT);
  mqtt.setKeepAlive(30);

  delay(800);
  lcd.clear();
}

// ==================== LOOP ====================
void loop() {

  atualizarBotoes();

  if (WiFi.status() != WL_CONNECTED) {
    conectarWiFi();
  }

  if (!mqtt.connected()) {
    conectarMQTT();
  }
  mqtt.loop();

  const unsigned long agora = millis();

  if (agora - ultimaLeitura >= INTERVALO_LEITURA) {
    ultimaLeitura = agora;
    lerSensores();
    atualizarLEDsEBuzzer();
  }

  if (agora - ultimoEnvioMQTT >= INTERVALO_MQTT) {
    ultimoEnvioMQTT = agora;
    publicarDados();
  }

  if (sistemaLigado &&
    agora - ultimaAtualizacaoLCD >= INTERVALO_LCD) {
    ultimaAtualizacaoLCD = agora;
    atualizarLCD();
  }
}

// ==================== BOTÕES ====================
void atualizarBotoes() {
  static int leituraAnteriorLigar = HIGH;
  static int estadoEstavelLigar = HIGH;
  static unsigned long tempoLigar = 0;

  static int leituraAnteriorDesligar = HIGH;
  static int estadoEstavelDesligar = HIGH;
  static unsigned long tempoDesligar = 0;

  const unsigned long debounce = 10;

  // Botão de ligar
  int leituraLigar = digitalRead(PIN_BTN_LIGAR);

  if (leituraLigar != leituraAnteriorLigar) {
    tempoLigar = millis();
    leituraAnteriorLigar = leituraLigar;
  }

  if (millis() - tempoLigar >= debounce &&
      leituraLigar != estadoEstavelLigar) {
    estadoEstavelLigar = leituraLigar;

    if (estadoEstavelLigar == LOW) {
      sistemaLigado = true;

      atualizarLEDsEBuzzer();
      atualizarLCD();

      // Reinicia o intervalo de atualização do LCD
      ultimaAtualizacaoLCD = millis();

      Serial.println("Sistema LIGADO");
    }
  }

  // Botão de desligar
  int leituraDesligar = digitalRead(PIN_BTN_DESLIGAR);

  if (leituraDesligar != leituraAnteriorDesligar) {
    tempoDesligar = millis();
    leituraAnteriorDesligar = leituraDesligar;
  }

  if (millis() - tempoDesligar >= debounce &&
      leituraDesligar != estadoEstavelDesligar) {
    estadoEstavelDesligar = leituraDesligar;

    if (estadoEstavelDesligar == LOW) {
      sistemaLigado = false;

      atualizarLEDsEBuzzer();
      atualizarLCD();

      // Reinicia o intervalo de atualização do LCD
      ultimaAtualizacaoLCD = millis();

      Serial.println("Sistema DESLIGADO");
    }
  }
}

// ==================== WI-FI ====================
void conectarWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.print("Conectando ao Wi-Fi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  const unsigned long inicio = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - inicio < 15000) {
    delay(250);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWi-Fi conectado.");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWi-Fi ainda indisponivel; tentarei novamente.");
  }
}

// ==================== MQTT ====================
void conectarMQTT() {
  if (WiFi.status() != WL_CONNECTED || mqtt.connected()) return;

  Serial.print("Conectando ao broker MQTT ");
  Serial.println(MQTT_BROKER);
  Serial.print("Client ID: ");
  Serial.println(MQTT_CLIENT_ID);

  if (mqtt.connect(MQTT_CLIENT_ID.c_str())) {
    Serial.println("MQTT conectado.");
    mqtt.subscribe(MQTT_TOPIC_SUBSCRIBE.c_str());
    publicarEstadoSistema();
  } else {
    Serial.print("Falha MQTT, codigo: ");
    Serial.println(mqtt.state());
  }
}

void callbackMQTT(char* topic, byte* payload, unsigned int length) {
  String mensagem;
  mensagem.reserve(length);

  for (unsigned int i = 0; i < length; i++) {
    mensagem += static_cast<char>(payload[i]);
  }
  mensagem.trim();
  mensagem.toLowerCase();

  Serial.print("Mensagem MQTT [");
  Serial.print(topic);
  Serial.print("]: ");
  Serial.println(mensagem);

  const String comandoON = TOPIC_PREFIX + "@on|";
  const String comandoOFF = TOPIC_PREFIX + "@off|";
  const String respostaON = comandoON + "ok";
  const String respostaOFF = comandoOFF + "ok";

  if (mensagem == comandoON || mensagem == "on" ||
      mensagem == "1" || mensagem == "s|on") {
    mqtt.publish(MQTT_TOPIC_COMMAND_EXECUTE.c_str(), respostaON.c_str());
    sistemaLigado = true;
    atualizarLEDsEBuzzer();
    publicarEstadoSistema();
    atualizarLCD();
    ultimaAtualizacaoLCD = millis();

  } else if (mensagem == comandoOFF || mensagem == "off" ||
             mensagem == "0" || mensagem == "s|off") {
    mqtt.publish(MQTT_TOPIC_COMMAND_EXECUTE.c_str(), respostaOFF.c_str());
    sistemaLigado = false;
    atualizarLEDsEBuzzer();
    publicarEstadoSistema();
    atualizarLCD();
    ultimaAtualizacaoLCD = millis();
  }
}

void publicarEstadoSistema() {
  if (!mqtt.connected()) return;

  const char* estado = sistemaLigado ? "s|on" : "s|off";
  mqtt.publish(MQTT_TOPIC_PUBLISH.c_str(), estado);
}

// ==================== SENSORES ====================
void lerSensores() {
  const float novaTemperatura = dht.readTemperature();
  const float novaUmidade = dht.readHumidity();

  // Se o DHT22 falhar numa leitura, mantém o último valor válido.
  if (!isnan(novaTemperatura)) temperatura = novaTemperatura;
  if (!isnan(novaUmidade)) umidade = novaUmidade;

  const int leituraLDR = analogRead(PIN_LDR);
  luminosidade = map(leituraLDR, 0, 4095, 0, 100);
  luminosidade = constrain(luminosidade, 0, 100);

  Serial.print("Temperatura: ");
  if (isnan(temperatura)) Serial.print("--");
  else Serial.print(temperatura, 1);
  Serial.print(" C | Umidade: ");
  if (isnan(umidade)) Serial.print("--");
  else Serial.print(umidade, 1);
  Serial.print(" % | Luz: ");
  Serial.print(luminosidade);
  Serial.println("%");
}

// ==================== LEDS / BUZZER ====================
void atualizarLEDsEBuzzer() {
  if (!sistemaLigado) {
    digitalWrite(PIN_LED_VERDE, LOW);
    digitalWrite(PIN_LED_AMARELO, LOW);
    digitalWrite(PIN_LED_VERMELHO, LOW);
    digitalWrite(PIN_BUZZER, LOW);
    alertaCritico = false;
    return;
  }

  if (isnan(temperatura) || isnan(umidade)) {
    digitalWrite(PIN_LED_VERDE, LOW);
    digitalWrite(PIN_LED_AMARELO, HIGH);
    digitalWrite(PIN_LED_VERMELHO, LOW);
    digitalWrite(PIN_BUZZER, LOW);
    alertaCritico = false;
    return;
  }

  bool perigo = false;
  bool atencao = false;

  // LUMINOSIDADE: valores de 0 a 100%
  if (luminosidade <= 10 || luminosidade >= 90) {
    perigo = true;
  } else if (luminosidade < 20 || luminosidade > 60) {
    atencao = true;
  }

  // TEMPERATURA: graus Celsius
  if (temperatura < 5 || temperatura >= 35) {
    perigo = true;
  } else if (temperatura < 10 || temperatura > 27) {
    atencao = true;
  }

  // UMIDADE: porcentagem relativa
  if (umidade < 30 || umidade > 90) {
    perigo = true;
  } else if (umidade < 50 || umidade > 80) {
    atencao = true;
  }

  if (perigo) {
    digitalWrite(PIN_LED_VERDE, LOW);
    digitalWrite(PIN_LED_AMARELO, LOW);
    digitalWrite(PIN_LED_VERMELHO, HIGH);
    digitalWrite(PIN_BUZZER, HIGH);
    alertaCritico = true;
  } else if (atencao) {
    digitalWrite(PIN_LED_VERDE, LOW);
    digitalWrite(PIN_LED_AMARELO, HIGH);
    digitalWrite(PIN_LED_VERMELHO, LOW);
    digitalWrite(PIN_BUZZER, LOW);
    alertaCritico = false;
  } else {
    digitalWrite(PIN_LED_VERDE, HIGH);
    digitalWrite(PIN_LED_AMARELO, LOW);
    digitalWrite(PIN_LED_VERMELHO, LOW);
    digitalWrite(PIN_BUZZER, LOW);
    alertaCritico = false;
  }
}

// ==================== LCD: APENAS DUAS TELAS ====================
void atualizarLCD() {
  lcd.backlight();
  lcd.clear();

  if (!sistemaLigado) {
    lcd.setCursor(0, 0);
    lcd.print("Sistema pausado");

    lcd.setCursor(0, 1);
    lcd.print("Pressione ligar...");
    return;
  }

  if (paginaLCD == 0) {
    lcd.setCursor(0, 0);
    lcd.print("Temp:");

    if (isnan(temperatura)) {
      lcd.print("--.- C");
    } else {
      lcd.print(temperatura, 1);
      lcd.print((char)223);
      lcd.print("C");
    }

    lcd.setCursor(0, 1);
    lcd.print("Umid:");

    if (isnan(umidade)) {
      lcd.print("--.- %");
    } else {
      lcd.print(umidade, 1);
      lcd.print("%");
    }
  } else {
    lcd.setCursor(0, 0);
    lcd.print("Luz: ");
    lcd.print(luminosidade);
    lcd.print("%");

    lcd.setCursor(0, 1);

    if (alertaCritico) {
      lcd.print("ALERTA ambiente");
    } else if (luminosidade < LUZ_BAIXA ||
               luminosidade > LUZ_ALTA) {
      lcd.print("Verificar luz");
    } else {
      lcd.print("Ambiente OK");
    }
  }
}

// ==================== PUBLICAÇÃO MQTT ====================
void publicarDados() {
  if (!mqtt.connected()) return;

  const String valorLuminosidade = String(luminosidade);
  mqtt.publish(MQTT_TOPIC_LUMINOSITY.c_str(), valorLuminosidade.c_str());

  if (!isnan(temperatura)) {
    const String valorTemperatura = String(temperatura, 1);
    mqtt.publish(MQTT_TOPIC_TEMPERATURE.c_str(), valorTemperatura.c_str());
  }

  if (!isnan(umidade)) {
    const String valorUmidade = String(umidade, 1);
    mqtt.publish(MQTT_TOPIC_HUMIDITY.c_str(), valorUmidade.c_str());
  }
}