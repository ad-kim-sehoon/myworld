extends CharacterBody2D

# 플레이어 기본 이동 스크립트 (Godot 4.x, 한국어 주석)
# - 키보드(ui_* 액션)로 이동
# - 간단한 터치/마우스 클릭으로 목표 지점 이동(모바일 대응의 기본 형태)
# - 들여쓰기: 2-space

const SPEED := 200.0 # 이동 속도 (픽셀/초)
var target: Vector2 = null

func _ready() -> void:
  # 입력 맵에 'click' 액션을 추가하면 터치/마우스 입력에 반응합니다.
  print("플레이어 준비 완료 (Godot 4.x)")

func _physics_process(delta: float) -> void:
  # 입력 처리 (ui_* 액션 사용 권장)
  var input_vector := Vector2(
    Input.get_action_strength("ui_right") - Input.get_action_strength("ui_left"),
    Input.get_action_strength("ui_down") - Input.get_action_strength("ui_up")
  )

  # 마우스/터치로 목표 설정
  if Input.is_action_pressed("click"):
    target = get_global_mouse_position()

  var motion := Vector2.ZERO
  if input_vector != Vector2.ZERO:
    motion = input_vector.normalized() * SPEED
    target = null
  elif target != null:
    var dir := target - global_position
    if dir.length() < 8.0:
      motion = Vector2.ZERO
      target = null
    else:
      motion = dir.normalized() * SPEED
  else:
    motion = Vector2.ZERO

  # Godot 4.x: move_and_slide를 사용하여 충돌과 이동 처리
  motion = move_and_slide(motion)

func _input(event) -> void:
  # 추가 입력 처리(예: 클릭 액션 전용 로직)이 필요하면 구현하세요.
  pass
