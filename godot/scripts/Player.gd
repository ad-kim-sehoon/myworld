extends KinematicBody2D

# 플레이어 기본 이동 스크립트 (한국어 주석)
# - 키보드(WASD / 방향키)로 이동
# - 간단한 터치/마우스 드래그로 이동 목표 설정(모바일 대응의 아주 기본 형태)
# - 속도와 물리 처리는 간단한 형태로 유지

var speed = 200 # 이동 속도 (픽셀/초)
var velocity = Vector2.ZERO
var target = null

func _ready():
	# 입력 맵은 Godot 에디터에서 설정 가능하나, 기본 키를 코드에서 보조적으로 처리함
	print("플레이어 준비 완료")

func _physics_process(delta):
	# 키보드 입력 처리
	var input_vector = Vector2.ZERO
	input_vector.x = Input.get_action_strength("ui_right") - Input.get_action_strength("ui_left")
	input_vector.y = Input.get_action_strength("ui_down") - Input.get_action_strength("ui_up")
	
	# WASD 대체 입력 (일부 환경에서 ui_*가 미설정일 수 있어 보조)
	if input_vector == Vector2.ZERO:
		if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
			input_vector.x += 1
		if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
			input_vector.x -= 1
		if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN):
			input_vector.y += 1
		if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
			input_vector.y -= 1
	
	# 터치/마우스 이동: 화면을 터치하거나 클릭한 지점으로 이동
	if Input.is_action_pressed("click"):
		# 모바일에서는 터치, 데스크탑에서는 마우스 클릭을 같은 액션으로 맵핑할 것을 권장
		target = get_global_mouse_position()

	# 우선순위: 입력키가 있으면 키 기반 이동, 아니면 타겟으로 이동
	if input_vector != Vector2.ZERO:
		velocity = input_vector.normalized() * speed
		target = null
	elif target != null:
		var dir = (target - global_position)
		if dir.length() < 8:
			velocity = Vector2.ZERO
			target = null
		else:
			velocity = dir.normalized() * speed
	else:
		velocity = Vector2.ZERO

	velocity = move_and_slide(velocity)

func _input(event):
	# 마우스 좌클릭 또는 터치는 'click' 액션으로 매핑하는 것을 권장합니다.
	pass
